import base64
import logging
from dataclasses import dataclass

import requests

try:
    import tomllib
except ImportError:
    import tomli as tomllib

from startrack.config import HTTP_REQUEST_TIMEOUT

logger = logging.getLogger(__name__)

PYPISTATS_API_URL = "https://pypistats.org/api/packages"
GITHUB_RAW_CONTENT_URL = "https://api.github.com/repos"


@dataclass
class PyPIPackageData:
    """Data class for storing PyPI package information.

    Attributes:
        name (str): The name of the package.
        daily_downloads (int): The number of daily downloads.
    """

    name: str
    daily_downloads: int


def fetch_pypi_downloads(package_name: str) -> int | None:
    """Fetch daily download count for a PyPI package.

    Args:
        package_name (str): The name of the PyPI package.

    Returns:
        int | None: The daily download count, or None if the request fails.
    """
    url = f"{PYPISTATS_API_URL}/{package_name}/recent"
    params = {"period": "day"}

    try:
        response = requests.get(url, params=params, timeout=HTTP_REQUEST_TIMEOUT)

        if response.status_code == requests.codes.OK:
            data = response.json()
            return data.get("data", {}).get("last_day")

        logger.warning(
            f"Failed to fetch PyPI stats for {package_name}: "
            f"{response.status_code} - {response.text}"
        )
        return None
    except requests.RequestException as e:
        logger.error(f"Request error fetching PyPI stats for {package_name}: {e}")
        return None


def _fetch_github_file_content(
    github_token: str,
    repo_full_name: str,
    file_path: str,
) -> str | None:
    """Fetch and decode a file from a GitHub repository.

    Args:
        github_token: The GitHub personal access token.
        repo_full_name: The full name of the repository (owner/repo).
        file_path: Path to the file in the repository.

    Returns:
        The decoded file content, or None if not found.
    """
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {github_token}",
    }
    url = f"{GITHUB_RAW_CONTENT_URL}/{repo_full_name}/contents/{file_path}"

    try:
        response = requests.get(url, headers=headers, timeout=HTTP_REQUEST_TIMEOUT)
        if response.status_code != requests.codes.OK:
            return None

        data = response.json()
        content = data.get("content", "")
        return base64.b64decode(content).decode("utf-8")
    except (requests.RequestException, UnicodeDecodeError):
        return None


def _extract_name_from_pyproject(content: str) -> str | None:
    """Extract package name from pyproject.toml content."""
    try:
        pyproject = tomllib.loads(content)
        name = pyproject.get("project", {}).get("name")
        if name:
            return name
        return pyproject.get("tool", {}).get("poetry", {}).get("name")
    except tomllib.TOMLDecodeError:
        return None


def _extract_name_from_setup_py(content: str) -> str | None:
    """Extract package name from setup.py content using regex."""
    import re

    patterns = [
        r'name\s*=\s*["\']([^"\']+)["\']',
        r'name\s*=\s*([a-zA-Z_][a-zA-Z0-9_-]*)',
    ]
    for pattern in patterns:
        match = re.search(pattern, content)
        if match:
            return match.group(1)
    return None


def _extract_name_from_setup_cfg(content: str) -> str | None:
    """Extract package name from setup.cfg content."""
    import configparser
    import io

    try:
        config = configparser.ConfigParser()
        config.read_string(content)
        return config.get("metadata", "name", fallback=None)
    except configparser.Error:
        return None


def fetch_package_name_from_repo(
    github_token: str,
    repo_full_name: str,
) -> str | None:
    """Extract PyPI package name from a GitHub repository.

    Checks pyproject.toml, setup.py, and setup.cfg in order.

    Args:
        github_token (str): The GitHub personal access token for authentication.
        repo_full_name (str): The full name of the repository (owner/repo).

    Returns:
        str | None: The package name if found, otherwise None.
    """
    content = _fetch_github_file_content(github_token, repo_full_name, "pyproject.toml")
    if content:
        name = _extract_name_from_pyproject(content)
        if name:
            return name

    content = _fetch_github_file_content(github_token, repo_full_name, "setup.py")
    if content:
        name = _extract_name_from_setup_py(content)
        if name:
            return name

    content = _fetch_github_file_content(github_token, repo_full_name, "setup.cfg")
    if content:
        name = _extract_name_from_setup_cfg(content)
        if name:
            return name

    return None


def discover_pypi_packages_from_org(
    github_token: str,
    org_name: str,
    repos: list[dict],
) -> list[str]:
    """Discover PyPI packages from an organization's GitHub repositories.

    Skips forked repositories to avoid listing packages from other organizations.

    Args:
        github_token (str): The GitHub personal access token for authentication.
        org_name (str): The name of the GitHub organization.
        repos (list[dict]): List of repository data dicts from GitHub API.

    Returns:
        list[str]: A list of discovered PyPI package names.
    """
    packages = []

    for repo in repos:
        repo_full_name = repo.get("full_name")
        if not repo_full_name:
            continue

        if repo.get("fork", False):
            logger.debug(f"Skipping forked repo: {repo_full_name}")
            continue

        package_name = fetch_package_name_from_repo(github_token, repo_full_name)
        if package_name:
            logger.info(f"Discovered PyPI package '{package_name}' from {repo_full_name}")
            packages.append(package_name)

    return packages


def fetch_all_pypi_stats(packages: list[str]) -> list[PyPIPackageData]:
    """Fetch download stats for a list of PyPI packages.

    Args:
        packages (list[str]): List of package names.

    Returns:
        list[PyPIPackageData]: List of package data with download counts.
    """
    results = []
    seen = set()

    for package_name in packages:
        if package_name in seen:
            continue
        seen.add(package_name)

        downloads = fetch_pypi_downloads(package_name)
        if downloads is not None:
            results.append(PyPIPackageData(name=package_name, daily_downloads=downloads))

    return results
