import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any

import pandas as pd
import requests

from startrack.config import HTTP_REQUEST_TIMEOUT

logger = logging.getLogger(__name__)


@dataclass
class RepositoryData:
    """Data class for storing repository information.

    Attributes:
        full_name (str): The name of the repository.
        star_count (int): The number of stars the repository has.
        fork_count (int): The number of forks the repository has.
    """

    full_name: str
    star_count: int
    fork_count: int

    @classmethod
    def from_json(cls: type["RepositoryData"], data: dict[str, Any]) -> "RepositoryData":
        """Create a RepositoryData instance from a JSON dictionary.

        Args:
            data (Dict[str, Any]): A dictionary containing repository data.

        Returns:
            RepositoryData: An instance of RepositoryData.
        """
        full_name = data["full_name"]
        star_count = data["stargazers_count"]
        fork_count = data["forks_count"]
        return cls(full_name=full_name, star_count=star_count, fork_count=fork_count)


class RepositoryType(Enum):
    """Enum for specifying types of repositories.

    Attributes:
        ALL: Represents all types of repositories.
        PUBLIC: Represents public repositories.
        PRIVATE: Represents private repositories.
        FORKS: Represents forked repositories.
        SOURCES: Represents source repositories.
        MEMBER: Represents member repositories.
    """

    ALL = "all"
    PUBLIC = "public"
    PRIVATE = "private"
    FORKS = "forks"
    SOURCES = "sources"
    MEMBER = "member"


def fetch_all_organization_repositories(
    github_token: str,
    organization_name: str,
    repository_type: RepositoryType,
) -> list:
    """Fetch all repositories of a specified organization.

    Args:
        github_token (str): The GitHub personal access token for authentication.
        organization_name (str): The name of the GitHub organization whose repositories
            are to be fetched.
        repository_type (RepositoryType): The type of repositories to fetch.

    Returns:
        List: A list of repositories.
    """
    all_repositories = []
    page = 1
    with requests.Session() as session:
        while True:
            try:
                repos = fetch_organization_repositories_by_page(
                    session=session,
                    github_token=github_token,
                    organization_name=organization_name,
                    repository_type=repository_type,
                    page=page,
                )
                if not repos:
                    break
                all_repositories.extend(repos)
                page += 1
            except requests.HTTPError as e:
                logger.error(
                    f"Failed to fetch page {page} for {organization_name}: {e}"
                )
                break

    return all_repositories


def handle_rate_limit(response: requests.Response) -> None:
    """Handle GitHub API rate limiting by waiting if necessary.

    Args:
        response: The response object from a GitHub API request.
    """
    remaining = response.headers.get("X-RateLimit-Remaining")
    if remaining is not None and int(remaining) == 0:
        reset_time = int(response.headers.get("X-RateLimit-Reset", 0))
        sleep_time = max(reset_time - time.time(), 0) + 1
        logger.warning(f"Rate limit exceeded. Sleeping for {sleep_time:.0f} seconds.")
        time.sleep(sleep_time)


def fetch_organization_repositories_by_page(
    session: requests.Session,
    github_token: str,
    organization_name: str,
    repository_type: RepositoryType = RepositoryType.ALL,
    page: int = 1,
) -> list:
    """Lists the repositories of a specified GitHub organization based on the repository
    type and page number.

    Args:
        github_token (str): The GitHub personal access token for authentication.
        organization_name (str): The name of the GitHub organization whose repositories
            are to be listed.
        repository_type (RepositoryType): The type of repositories to list. Defaults to
            RepositoryType.ALL.
        page (int): The page number of the results to fetch. Defaults to 1.

    Returns:
        List: A list containing details of the organization's repositories.

    Raises:
        requests.HTTPError: If the API request fails.
    """
    headers = {
        "Accept-Encoding": "gzip",
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {github_token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    params = {
        "type": repository_type.value,
        "page": page,
    }

    url = f"https://api.github.com/orgs/{organization_name}/repos"

    response = session.get(
        url, headers=headers, params=params, timeout=HTTP_REQUEST_TIMEOUT
    )

    handle_rate_limit(response)

    if response.status_code != requests.codes.OK:
        logger.error(
            f"Failed to fetch repositories for {organization_name}: "
            f"{response.status_code} - {response.text}"
        )
        response.raise_for_status()

    return response.json()


def convert_repositories_to_dataframe(
    repositories: list[RepositoryData],
) -> pd.DataFrame:
    """Convert a list of RepositoryData objects into a pandas DataFrame.

    Args:   
        repositories (List[RepositoryData]): A list of RepositoryData objects.

    Returns:
        pd.DataFrame: A DataFrame where each row represents a repository, with columns
            for the repository's name and star count.
    """
    data = [
        {"full_name": repository.full_name, "star_count": repository.star_count}
        for repository in repositories
    ]
    return pd.DataFrame(data)


def fetch_repository_data_by_full_name(
    github_token: str,
    repository_full_name: str,
) -> dict[str, Any] | None:
    """Fetch data for a specific repository by its full name.

    Args:
        github_token (str): The GitHub personal access token for authentication.
        repository_full_name (str): The full name of the repository.

    Returns:
        Dict[str, Any]: A dictionary containing repository data if the request is
            successful, otherwise None.
    """
    headers = {
        "Accept-Encoding": "gzip",
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {github_token}",
    }
    url = f"https://api.github.com/repos/{repository_full_name}"

    try:
        response = requests.get(url, headers=headers, timeout=HTTP_REQUEST_TIMEOUT)
        handle_rate_limit(response)

        if response.status_code == requests.codes.OK:
            return response.json()

        logger.warning(
            f"Failed to fetch repository {repository_full_name}: "
            f"{response.status_code} - {response.text}"
        )
        return None
    except requests.RequestException as e:
        logger.error(f"Request error fetching {repository_full_name}: {e}")
        return None
