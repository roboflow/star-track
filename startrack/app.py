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
    INPUT_REPOSITORIES_ENV,
)
from startrack.core import (
    RepositoryData,
    RepositoryType,
    convert_repositories_to_dataframe,
    fetch_all_organization_repositories,
    fetch_repository_data_by_full_name,
)

GITHUB_TOKEN = os.environ.get(GITHUB_TOKEN_ENV)
ORGANIZATIONS = os.environ.get(INPUT_ORGANIZATIONS_ENV)
REPOSITORIES = os.environ.get(INPUT_REPOSITORIES_ENV, "")
OUTPUT_PATH = os.environ.get(INPUT_OUTPUT_PATH_ENV, "data")
OUTPUT_FILENAME = os.environ.get(INPUT_OUTPUT_FILENAME_ENV, "data.csv")

ORGANIZATION_NAMES = [org.strip() for org in ORGANIZATIONS.split(",") if org.strip()]
REPOSITORY_NAMES = [repo.strip() for repo in REPOSITORIES.split(",") if repo.strip()]


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
    repos = fetch_all_organization_repositories(
        github_token=GITHUB_TOKEN,
        organization_name=organization_name,
        repository_type=RepositoryType.PUBLIC,
    )
    return [RepositoryData.from_json(repo) for repo in repos]


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

    with concurrent.futures.ThreadPoolExecutor() as executor:
        # Fetch repositories from specified organizations in parallel
        organization_futures = [
            executor.submit(fetch_organization_repositories, org_name)
            for org_name in ORGANIZATION_NAMES
        ]

        # Fetch specified repositories in parallel
        repository_futures = [
            executor.submit(fetch_individual_repository, repo_name)
            for repo_name in REPOSITORY_NAMES
        ]

        # Collect results from organization futures
        for future in concurrent.futures.as_completed(organization_futures):
            all_repositories.extend(future.result())

        # Collect results from repository futures
        for future in concurrent.futures.as_completed(repository_futures):
            repo_data = future.result()
            if repo_data:
                all_repositories.append(repo_data)

    return all_repositories


def main() -> None:
    """
    "Main function to fetch repository data, update the DataFrame, and save it to a CSV file.
    """  # noqa: E501

    if not GITHUB_TOKEN:
        msg = (
            "`GITHUB_TOKEN` is not set. Please set the `GITHUB_TOKEN` environment "
            "variable."
        )
        raise ValueError(
            msg,
        )
    if not ORGANIZATION_NAMES and not REPOSITORY_NAMES:
        msg = (
            "Either `ORGANIZATION_NAMES` or `REPOSITORY_NAMES` must be set. Please "
            "provide at least one organization name or repository name."
        )
        raise ValueError(
            msg,
        )

    repositories = get_all_repositories()
    df = convert_repositories_to_dataframe(repositories)
    df = df.set_index("full_name").T

    current_date = datetime.now().strftime("%Y-%m-%d")
    df.index = [current_date]

    # Load existing data if the file exists
    file_path = Path(OUTPUT_PATH) / OUTPUT_FILENAME
    if Path.exists(file_path, follow_symlinks=False):
        existing_df = pd.read_csv(file_path, index_col=0)
        df = pd.concat([existing_df, df])

    save_to_csv(
        df=df,
        directory=OUTPUT_PATH,
        filename=OUTPUT_FILENAME,
    )


if __name__ == "__main__":
    main()
