"""
Discovery tool for finding PyPI packages from GitHub organizations.

Usage:
    python -m startrack.discover --org roboflow
    python -m startrack.discover --org roboflow --org ultralytics
"""

import argparse
import sys

from startrack.core import RepositoryType, fetch_all_organization_repositories
from startrack.pypi import fetch_package_name_from_repo, fetch_pypi_downloads


def discover_packages_for_org(
    github_token: str,
    org_name: str,
) -> tuple[list[tuple[str, str]], list[tuple[str, str, str]]]:
    """Discover PyPI packages from an organization's GitHub repositories.

    Args:
        github_token: GitHub personal access token.
        org_name: Name of the GitHub organization.

    Returns:
        tuple: (valid_packages, invalid_packages)
            - valid_packages: List of (package_name, repo_name) tuples
            - invalid_packages: List of (package_name, repo_name, reason) tuples
    """
    print(f"\nScanning organization: {org_name}")
    print("-" * 40)

    repos = fetch_all_organization_repositories(
        github_token=github_token,
        organization_name=org_name,
        repository_type=RepositoryType.PUBLIC,
    )

    valid_packages = []
    invalid_packages = []
    seen_packages = set()

    for repo in repos:
        repo_full_name = repo.get("full_name", "")
        repo_name = repo_full_name.split("/")[-1] if repo_full_name else "unknown"

        if repo.get("fork", False):
            print(f"  [SKIP] {repo_name} (forked repo)")
            continue

        package_name = fetch_package_name_from_repo(github_token, repo_full_name)

        if not package_name:
            continue

        if package_name in seen_packages:
            continue
        seen_packages.add(package_name)

        print(f"  [CHECK] {package_name} (from {repo_name})...", end=" ")

        downloads = fetch_pypi_downloads(package_name)

        if downloads is not None:
            print(f"OK ({downloads:,} daily downloads)")
            valid_packages.append((package_name, repo_name))
        else:
            print("NOT FOUND on PyPI")
            invalid_packages.append((package_name, repo_name, "404 - not on PyPI"))

    return valid_packages, invalid_packages


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Discover PyPI packages from GitHub organizations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python -m startrack.discover --org roboflow
    python -m startrack.discover --org roboflow --org ultralytics --token ghp_xxx
        """,
    )
    parser.add_argument(
        "--org",
        action="append",
        required=True,
        dest="organizations",
        help="GitHub organization name (can be specified multiple times)",
    )
    parser.add_argument(
        "--token",
        default=None,
        help="GitHub token (or set GITHUB_TOKEN env var)",
    )

    args = parser.parse_args()

    import os

    github_token = args.token or os.environ.get("GITHUB_TOKEN")

    if not github_token:
        print("Error: GitHub token required. Use --token or set GITHUB_TOKEN env var.")
        sys.exit(1)

    all_valid = []
    all_invalid = []

    for org in args.organizations:
        valid, invalid = discover_packages_for_org(github_token, org)
        all_valid.extend(valid)
        all_invalid.extend(invalid)

    print("\n" + "=" * 50)
    print("DISCOVERY SUMMARY")
    print("=" * 50)

    if all_valid:
        print(f"\nFound {len(all_valid)} packages on PyPI:")
        for pkg, repo in sorted(all_valid):
            print(f"  - {pkg} (from {repo})")

    if all_invalid:
        print(f"\nNot on PyPI ({len(all_invalid)} packages):")
        for pkg, repo, reason in sorted(all_invalid):
            print(f"  - {pkg} (from {repo}): {reason}")

    if all_valid:
        package_list = ",".join(sorted(pkg for pkg, _ in all_valid))
        print("\n" + "-" * 50)
        print("Suggested configuration:")
        print("-" * 50)
        print(f'\nexport INPUT_PYPI_PACKAGES="{package_list}"')
        print()


if __name__ == "__main__":
    main()
