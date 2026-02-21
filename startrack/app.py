import concurrent.futures
import os
from datetime import datetime
from pathlib import Path

import pandas as pd

from startrack.config import (
    GITHUB_TOKEN_ENV,
    INPUT_ORGANIZATIONS_ENV,
    INPUT_OUTPUT_FILENAME_ENV,
    INPUT_OUTPUT_PATH_ENV,
    INPUT_PYPI_PACKAGES_ENV,
    INPUT_REPOSITORIES_ENV,
    PYPI_OUTPUT_FILENAME_ENV,
)
from startrack.core import (
    RepositoryData,
    RepositoryType,
    convert_repositories_to_dataframe,
    fetch_all_organization_repositories,
    fetch_repository_data_by_full_name,
)
from startrack.pypi import (
    PyPIPackageData,
    fetch_all_pypi_stats,
)

GITHUB_TOKEN = os.environ.get(GITHUB_TOKEN_ENV)
ORGANIZATIONS = os.environ.get(INPUT_ORGANIZATIONS_ENV, "")
REPOSITORIES = os.environ.get(INPUT_REPOSITORIES_ENV, "")
OUTPUT_PATH = os.environ.get(INPUT_OUTPUT_PATH_ENV, "data")
OUTPUT_FILENAME = os.environ.get(INPUT_OUTPUT_FILENAME_ENV, "github_data.csv")

PYPI_PACKAGES = os.environ.get(INPUT_PYPI_PACKAGES_ENV, "")
PYPI_OUTPUT_FILENAME = os.environ.get(PYPI_OUTPUT_FILENAME_ENV, "pypi_data.csv")

ORGANIZATION_NAMES = [org.strip() for org in ORGANIZATIONS.split(",") if org.strip()]
REPOSITORY_NAMES = [repo.strip() for repo in REPOSITORIES.split(",") if repo.strip()]
PYPI_PACKAGE_NAMES = [pkg.strip() for pkg in PYPI_PACKAGES.split(",") if pkg.strip()]


def save_to_csv(df: pd.DataFrame, directory: str, filename: str) -> None:
    """Save a DataFrame to a CSV file in the specified directory.

    Args:
        df (pd.DataFrame): The DataFrame to save.
        directory (str): The directory where the CSV file will be saved.
        filename (str): The name of the CSV file.
    """
    if not os.path.exists(directory):
        os.makedirs(directory)

    file_path = os.path.join(directory, filename)
    df.to_csv(file_path)


def fetch_organization_repositories(organization_name: str) -> list[RepositoryData]:
    """Fetch repositories for an organization."""
    raw_repos = fetch_all_organization_repositories(
        github_token=GITHUB_TOKEN,
        organization_name=organization_name,
        repository_type=RepositoryType.PUBLIC,
    )
    return [RepositoryData.from_json(repo) for repo in raw_repos]


def fetch_individual_repository(repo_full_name: str) -> RepositoryData:
    repo_data = fetch_repository_data_by_full_name(
        github_token=GITHUB_TOKEN,
        repository_full_name=repo_full_name,
    )
    if repo_data:
        return RepositoryData.from_json(repo_data)
    return None


def get_all_repositories() -> list[RepositoryData]:
    """Fetch all repositories from specified organizations and individual repositories.

    Returns:
        List[RepositoryData]: A list of repository data objects.
    """
    all_repositories = []
    failed_orgs = []
    failed_repos = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        organization_futures = {
            executor.submit(fetch_organization_repositories, org_name): org_name
            for org_name in ORGANIZATION_NAMES
        }

        repository_futures = {
            executor.submit(fetch_individual_repository, repo_name): repo_name
            for repo_name in REPOSITORY_NAMES
        }

        for future in concurrent.futures.as_completed(organization_futures):
            org_name = organization_futures[future]
            try:
                repos = future.result()
                all_repositories.extend(repos)
            except Exception as e:
                failed_orgs.append(org_name)
                print(f"ERROR: Failed to fetch org '{org_name}': {e}")

        for future in concurrent.futures.as_completed(repository_futures):
            repo_name = repository_futures[future]
            try:
                repo_data = future.result()
                if repo_data:
                    all_repositories.append(repo_data)
            except Exception as e:
                failed_repos.append(repo_name)
                print(f"ERROR: Failed to fetch repo '{repo_name}': {e}")

    if failed_orgs or failed_repos:
        print(f"WARNING: Failed to fetch {len(failed_orgs)} orgs and {len(failed_repos)} repos")

    return all_repositories


def convert_pypi_to_dataframe(packages: list[PyPIPackageData]) -> pd.DataFrame:
    """Convert a list of PyPIPackageData objects into a pandas DataFrame.

    Args:
        packages: A list of PyPIPackageData objects.

    Returns:
        pd.DataFrame: A DataFrame with package names as columns and downloads as values.
    """
    data = [{"name": pkg.name, "daily_downloads": pkg.daily_downloads} for pkg in packages]
    return pd.DataFrame(data)


def main() -> None:
    """Main function to fetch repository and PyPI data, and save to CSV files."""
    if not GITHUB_TOKEN:
        msg = (
            "`GITHUB_TOKEN` is not set. Please set the `GITHUB_TOKEN` environment "
            "variable."
        )
        raise ValueError(msg)

    has_github_tracking = ORGANIZATION_NAMES or REPOSITORY_NAMES
    has_pypi_tracking = bool(PYPI_PACKAGE_NAMES)

    if not has_github_tracking and not has_pypi_tracking:
        msg = (
            "No tracking configured. Please provide at least one of: "
            "INPUT_ORGANIZATIONS, INPUT_REPOSITORIES, or INPUT_PYPI_PACKAGES."
        )
        raise ValueError(msg)

    current_date = datetime.now().strftime("%Y-%m-%d")

    # Track GitHub stars
    if has_github_tracking:
        repositories = get_all_repositories()
        df = convert_repositories_to_dataframe(repositories)
        df = df.set_index("full_name").T
        df.index = [current_date]

        file_path = Path(OUTPUT_PATH) / OUTPUT_FILENAME
        if file_path.exists():
            existing_df = pd.read_csv(file_path, index_col=0)
            if current_date in existing_df.index:
                existing_df = existing_df.drop(current_date)
            df = pd.concat([existing_df, df])

        save_to_csv(df=df, directory=OUTPUT_PATH, filename=OUTPUT_FILENAME)

    # Track PyPI downloads
    if has_pypi_tracking:
        pypi_stats = fetch_all_pypi_stats(PYPI_PACKAGE_NAMES)

        if pypi_stats:
            df = convert_pypi_to_dataframe(pypi_stats)
            df = df.set_index("name").T
            df.index = [current_date]

            file_path = Path(OUTPUT_PATH) / PYPI_OUTPUT_FILENAME
            if file_path.exists():
                existing_df = pd.read_csv(file_path, index_col=0)
                if current_date in existing_df.index:
                    existing_df = existing_df.drop(current_date)
                df = pd.concat([existing_df, df])

            save_to_csv(df=df, directory=OUTPUT_PATH, filename=PYPI_OUTPUT_FILENAME)


if __name__ == "__main__":
    main()
