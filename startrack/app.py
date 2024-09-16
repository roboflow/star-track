import os
from datetime import datetime
from typing import List
import pandas as pd

from startrack.config import GITHUB_TOKEN_ENV
from startrack.core import (
    list_organization_repositories,
    get_repository_data,
    RepositoryType,
    RepositoryData,
    to_dataframe
)

GITHUB_TOKEN = os.environ.get(GITHUB_TOKEN_ENV)

# Read input parameters
organizations = os.environ.get('INPUT_ORGANIZATIONS', '')
repositories = os.environ.get('INPUT_REPOSITORIES', '')

organization_names = [org.strip() for org in organizations.split(',') if org.strip()]
repository_names = [repo.strip() for repo in repositories.split(',') if repo.strip()]


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
    for organization_name in organization_names:
        repos = list_organization_repositories(
            github_token=GITHUB_TOKEN,
            organization_name=organization_name,
            repository_type=RepositoryType.PUBLIC
        )
        all_repositories.extend([RepositoryData.from_json(repo) for repo in repos])

    # Fetch specified repositories
    for repo_full_name in repository_names:
        repo_data = get_repository_data(
            github_token=GITHUB_TOKEN,
            repository_full_name=repo_full_name
        )
        if repo_data:
            all_repositories.append(RepositoryData.from_json(repo_data))

    return all_repositories


def main() -> None:
    """
    Main function to fetch repository data, update the DataFrame, and save it to a CSV file.
    """
    repositories = get_all_repositories()

    df = to_dataframe(repositories)
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
