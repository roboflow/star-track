import os
from datetime import datetime
from typing import List

import pandas as pd

from startrack.config import GITHUB_TOKEN_ENV, INPUT_ORGANIZATIONS_ENV, \
    INPUT_REPOSITORIES_ENV
from startrack.core import (
    RepositoryType,
    RepositoryData, fetch_all_organization_repositories,
    fetch_repository_data_by_full_name, convert_repositories_to_dataframe
)

GITHUB_TOKEN = os.environ.get(GITHUB_TOKEN_ENV)
ORGANIZATIONS = os.environ.get(INPUT_ORGANIZATIONS_ENV, '')
REPOSITORIES = os.environ.get(INPUT_REPOSITORIES_ENV, '')
ORGANIZATION_NAMES = [org.strip() for org in ORGANIZATIONS.split(',') if org.strip()]
REPOSITORY_NAMES = [repo.strip() for repo in REPOSITORIES.split(',') if repo.strip()]


def save_to_csv(df: pd.DataFrame, directory: str, filename: str) -> None:
    """
    Save a DataFrame to a CSV file in the specified directory.

    Args:
        df (pd.DataFrame): The DataFrame to save.
        directory (str): The directory where the CSV file will be saved.
        filename (str): The name of the CSV file.
    """
    if not os.path.exists(directory):
        os.makedirs(directory)

    file_path = os.path.join(directory, filename)
    df.to_csv(file_path)


def get_all_repositories() -> List[RepositoryData]:
    """
    Fetch all repositories from specified organizations and individual repositories.

    Returns:
        List[RepositoryData]: A list of repository data objects.
    """
    all_repositories = []

    # Fetch repositories from specified organizations
    for organization_name in ORGANIZATION_NAMES:
        repos = fetch_all_organization_repositories(
            github_token=GITHUB_TOKEN,
            organization_name=organization_name,
            repository_type=RepositoryType.PUBLIC
        )
        all_repositories.extend([RepositoryData.from_json(repo) for repo in repos])

    # Fetch specified repositories
    for repo_full_name in REPOSITORY_NAMES:
        repo_data = fetch_repository_data_by_full_name(
            github_token=GITHUB_TOKEN,
            repository_full_name=repo_full_name
        )
        if repo_data:
            all_repositories.append(RepositoryData.from_json(repo_data))

    return all_repositories


def main() -> None:
    """
    Main function to fetch repository data, update the DataFrame, and save it to a CSV
    file.
    """
    if not GITHUB_TOKEN:
        raise ValueError(
            "`GITHUB_TOKEN` is not set. Please set the `GITHUB_TOKEN` environment "
            "variable."
        )
    if not ORGANIZATION_NAMES and not REPOSITORY_NAMES:
        raise ValueError(
            "Either `ORGANIZATION_NAMES` or `REPOSITORY_NAMES` must be set. Please "
            "provide at least one organization name or repository name."
        )

    repositories = get_all_repositories()

    df = convert_repositories_to_dataframe(repositories)
    df = df.set_index('full_name').T

    current_date = datetime.now().strftime("%Y-%m-%d")
    df.index = [current_date]

    # Load existing data if the file exists
    file_path = os.path.join('data', 'data.csv')
    if os.path.exists(file_path):
        existing_df = pd.read_csv(file_path, index_col=0)
        df = pd.concat([existing_df, df])

    save_to_csv(
        df=df,
        directory='data',
        filename='data.csv'
    )


if __name__ == "__main__":
    main()
