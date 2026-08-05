"""Backfill missing daily download values in data/pypi_data.csv.

Fetches per-package daily history from the pypistats.org "overall" endpoint
(covers roughly the last 180 days) and fills empty cells and missing date
rows. Existing non-empty values are never overwritten unless --overwrite
is passed.

Usage:
    python scripts/backfill_pypi.py [--csv data/pypi_data.csv] [--overwrite]
"""

import argparse
import datetime as dt
import logging
import sys
import time
from pathlib import Path

import pandas as pd
import requests

PYPISTATS_OVERALL_URL = "https://pypistats.org/api/packages/{package}/overall"
HTTP_TIMEOUT = 30
MAX_RETRIES = 5

# The CSV mixes two dating conventions. Rows up to 2026-02-14 were backfilled
# with true dates (row date == download date). From 2026-02-17 onward the
# daily job stamps pypistats' `last_day` (which lags two days) with the
# collection date, so row date == download date + 2. Rows 2026-02-15/16 are
# intentionally absent: creating them would duplicate the downloads already
# stored at rows 2026-02-13/14. Verified empirically against the API for all
# 14 packages.
REGIME_TRANSITION = dt.date(2026, 2, 15)


def download_date_for_row(row_date: dt.date) -> dt.date:
    """Map a CSV row date to the download date its value represents."""
    if row_date < REGIME_TRANSITION:
        return row_date
    return row_date - dt.timedelta(days=2)


def row_date_for_download(download_date: dt.date) -> dt.date:
    """Map a download date to the CSV row it belongs in."""
    if download_date < REGIME_TRANSITION:
        return download_date
    return download_date + dt.timedelta(days=2)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("backfill_pypi")


def fetch_overall_history(session: requests.Session, package: str) -> dict[str, dict[str, int]]:
    """Fetch daily download history for a package, split by category.

    Returns:
        Mapping of category ("with_mirrors" / "without_mirrors") to a
        mapping of ISO date string -> download count.
    """
    url = PYPISTATS_OVERALL_URL.format(package=package.lower())

    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(url, timeout=HTTP_TIMEOUT)
        except requests.RequestException as e:
            logger.warning(f"{package}: request error ({e}), retrying")
            time.sleep(2**attempt)
            continue

        if response.status_code == requests.codes.OK:
            series: dict[str, dict[str, int]] = {}
            for entry in response.json().get("data", []):
                category = entry.get("category")
                date = entry.get("date")
                downloads = entry.get("downloads")
                if category and date and downloads is not None:
                    series.setdefault(category, {})[date] = downloads
            return series

        if response.status_code == requests.codes.NOT_FOUND:
            logger.warning(f"{package}: not found on pypistats (404), skipping")
            return {}

        if response.status_code == 429 or response.status_code >= 500:
            retry_after = response.headers.get("Retry-After")
            sleep_time = int(retry_after) if retry_after and retry_after.isdigit() else 2**attempt
            logger.warning(
                f"{package}: HTTP {response.status_code}, sleeping {sleep_time}s "
                f"(attempt {attempt + 1}/{MAX_RETRIES})"
            )
            time.sleep(sleep_time)
            continue

        logger.error(f"{package}: unexpected HTTP {response.status_code}: {response.text[:200]}")
        return {}

    logger.error(f"{package}: max retries exceeded")
    return {}


def pick_category(
    package: str,
    series: dict[str, dict[str, int]],
    existing: pd.Series,
) -> dict[str, int]:
    """Pick the category whose values best match existing non-empty cells.

    The daily job uses the /recent endpoint, which excludes mirrors, so
    "without_mirrors" is expected to win. Comparing against existing data
    (mapped through the row-date regime) verifies that assumption per package.
    """
    known = existing.dropna()
    best_category = None
    best_matches = -1

    for category, values in series.items():
        matches = 0
        comparable = 0
        for row_date_str, downloads in known.items():
            download_date = download_date_for_row(dt.date.fromisoformat(row_date_str))
            api_value = values.get(download_date.isoformat())
            if api_value is not None:
                comparable += 1
                if api_value == int(downloads):
                    matches += 1
        logger.info(
            f"{package}: category '{category}' matches {matches}/{comparable} "
            f"comparable existing values"
        )
        if matches > best_matches:
            best_matches = matches
            best_category = category

    if best_category is None:
        return {}

    if best_category != "without_mirrors":
        logger.warning(f"{package}: using unexpected category '{best_category}'")
    return series[best_category]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default="data/pypi_data.csv", help="Path to pypi_data.csv")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing non-empty values with API data",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    df = pd.read_csv(csv_path, index_col=0)
    packages = list(df.columns)
    logger.info(f"Loaded {csv_path}: {len(df)} rows, {len(packages)} packages")

    today = dt.date.today()
    filled_per_package: dict[str, int] = {}
    row_dates_covered: set[str] = set()

    with requests.Session() as session:
        for package in packages:
            series = fetch_overall_history(session, package)
            if not series:
                filled_per_package[package] = 0
                continue

            values = pick_category(package, series, df[package])
            if not values:
                filled_per_package[package] = 0
                continue

            # Map each API download date to its CSV row, skipping rows that
            # would land in the future (tomorrow's job will write them).
            row_values: dict[str, float] = {}
            for date_str, downloads in values.items():
                row_date = row_date_for_download(dt.date.fromisoformat(date_str))
                if row_date <= today:
                    row_values[row_date.isoformat()] = float(downloads)

            row_dates_covered.update(row_values)

            new_dates = [d for d in row_values if d not in df.index]
            if new_dates:
                df = df.reindex(df.index.union(new_dates))

            filled = 0
            for row_date_str, downloads in row_values.items():
                if args.overwrite or pd.isna(df.at[row_date_str, package]):
                    df.at[row_date_str, package] = downloads
                    filled += 1
            filled_per_package[package] = filled

    df = df.sort_index()
    df.to_csv(csv_path)

    logger.info("=== Summary ===")
    total = 0
    for package in packages:
        logger.info(f"  {package:18s}: filled {filled_per_package.get(package, 0)} cells")
        total += filled_per_package.get(package, 0)
    logger.info(f"Total cells filled: {total}")

    if row_dates_covered:
        window = df.loc[df.index >= min(row_dates_covered)]
        remaining = int(window.isna().sum().sum())
        logger.info(
            f"Remaining empty cells within API-covered row window "
            f"({min(row_dates_covered)}..{max(row_dates_covered)}): {remaining}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
