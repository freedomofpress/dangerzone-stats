#!/usr/bin/env -S uv run
# Needs "uv" to be run. chmod +x and then ./generate_stats.py
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "jinja2", "httpx"
# ]
# ///
import asyncio
import os
import re
import json
from pathlib import Path
from datetime import datetime, timedelta, timezone
from jinja2 import Environment, FileSystemLoader
import httpx
from typing import Dict, List, TypedDict
from collections import defaultdict

# FPF organization members (core members)
CORE_MEMBERS = {
    "AAdamGlenn", "aadamglenn2", "adaFPF", "adjoro", "AishFPF", "almet", "apyrgio",
    "avocadodavinci", "axhakani", "ByBrianaE", "caitlinvogus", "cfm", "chigby",
    "ChumOfChance", "clevername88", "conorsch", "csporras12", "daviserinanderson",
    "deeplow", "ei8fdb", "elioqoshi", "enpaul", "esummers18", "fpf-icinga-bot",
    "fpf-k8sbot", "fpfinfrabot", "fpfpypiscanner", "fpfsafetybot", "gsamaritano",
    "harlo", "harrislapiroff", "huertanix", "iiatyy", "InnaIMT", "JanelleFinch",
    "johnxu31", "jskinne3", "KAMcCudden", "kushaldas", "lblackfpf", "legoktm",
    "leharperclrefrm", "lsd-cat", "martinshelton", "maxabrams0", "mdaleo-fpf",
    "micahflee", "mig5", "nathandyer", "ninavizz", "plaidfinch", "plbarghouty",
    "redshiftzero", "rocodes", "RyanRiceFPF", "ryanwhitney", "SaptakS", "sdcibot",
    "Seth-Stern", "soleilera", "sophieongithub", "ssempervirens", "stephaniesugars",
    "trevortimm", "vickiniu", "weblate-fpf", "zenmonkeykstop", "zidanism", "zillahe",
    "zrobert7"
}

class ReleaseStats(TypedDict):
    releases: List[Dict]
    contributions: Dict

async def fetch_github_stats(repo: str, token: str = None) -> ReleaseStats:
    """Fetch GitHub release statistics"""
    headers = {}
    if token:
        # Support both classic (token) and fine-grained (Bearer) GitHub tokens
        if token.startswith("ghp_"):
            headers["Authorization"] = f"token {token}"
        elif token.startswith("github_pat_"):
            headers["Authorization"] = f"Bearer {token}"
        else:
            # Default to token prefix for backwards compatibility
            headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient(headers=headers) as client:
        # Fetch releases with download counts
        releases_resp = await client.get(
            f"https://api.github.com/repos/{repo}/releases"
        )

        # Check for rate limit errors
        if releases_resp.status_code == 403:
            remaining = releases_resp.headers.get('X-RateLimit-Remaining', '0')
            limit = releases_resp.headers.get('X-RateLimit-Limit', 'unknown')

            # Only treat as rate limit if actually at 0 remaining
            if remaining == '0':
                reset_time = releases_resp.headers.get("X-RateLimit-Reset")
                if reset_time:
                    reset_datetime = datetime.fromtimestamp(int(reset_time))
                    print(f"Rate limit exceeded. Resets at: {reset_datetime}")
                    print(f"Current rate limit: {remaining}/{limit}")
                    print("\nPlease wait until the rate limit resets or use a different token")
                raise httpx.HTTPStatusError(f"Rate limit exceeded", request=releases_resp.request, response=releases_resp)
            else:
                # 403 but not rate limit - might be authentication issue
                print(f"HTTP 403 Forbidden error (not rate limit)")
                print(f"Rate limit status: {remaining}/{limit} remaining")
                print(f"Response: {releases_resp.text[:200]}")
                print("\nThis might be due to:")
                print("1. Invalid or expired GitHub token")
                print("2. Token lacking required permissions (needs 'public_repo' or 'repo' scope)")
                print("3. Repository access restrictions")

        releases_resp.raise_for_status()
        releases = releases_resp.json()

        # Validate response is a list
        if not isinstance(releases, list):
            print(f"Unexpected releases response: {releases}")
            releases = []

        # Process releases to include download counts per asset
        processed_releases = []
        for release in releases:
            if not isinstance(release, dict):
                continue
            processed_releases.append({
                "name": release.get("name") or release.get("tag_name", "Unknown"),
                "published_at": release.get("published_at", ""),
                "html_url": release.get("html_url", ""),
                "assets": [{
                    "name": asset.get("name", ""),
                    "download_count": asset.get("download_count", 0),
                    "download_url": asset.get("browser_download_url", "")
                } for asset in release.get("assets", [])]
            })

    return {
        "releases": processed_releases,
        "contributions": {}
    }

async def fetch_contributions(repo: str, token: str = None) -> Dict:
    """Fetch new contributor statistics from GitHub API"""
    headers = {}
    if token:
        # Support both classic (token) and fine-grained (Bearer) GitHub tokens
        if token.startswith("ghp_"):
            headers["Authorization"] = f"token {token}"
        elif token.startswith("github_pat_"):
            headers["Authorization"] = f"Bearer {token}"
        else:
            # Default to token prefix for backwards compatibility
            headers["Authorization"] = f"token {token}"

    async with httpx.AsyncClient(headers=headers, timeout=60.0) as client:
        # Fetch commits and issues/PRs from last 3 years
        three_years_ago = (datetime.now() - timedelta(days=3*365)).isoformat()

        commits = []
        page = 1
        max_pages = 10  # Limit to 10 pages (1000 commits max)

        while page <= max_pages:
            try:
                commits_resp = await client.get(
                    f"https://api.github.com/repos/{repo}/commits",
                    params={"per_page": 100, "page": page, "since": three_years_ago}
                )
                commits_resp.raise_for_status()
                page_commits = commits_resp.json()
                if not page_commits:
                    break
                commits.extend(page_commits)
                page += 1
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 422:
                    break
                raise

        # Fetch issues and PRs from last 3 years
        issues = []
        page = 1
        max_pages = 10  # Limit to 10 pages

        while page <= max_pages:
            try:
                issues_resp = await client.get(
                    f"https://api.github.com/repos/{repo}/issues",
                    params={"state": "all", "per_page": 100, "page": page, "since": three_years_ago}
                )
                issues_resp.raise_for_status()
                page_issues = issues_resp.json()
                if not page_issues:
                    break
                issues.extend(page_issues)
                page += 1
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 422:
                    break
                raise

        # Track contributor data
        contributor_data = defaultdict(lambda: {
            "first_seen": None,
            "last_seen": None,
            "contribution_count": 0,
            "contributions_by_period": defaultdict(int)
        })

        new_contributors_by_month = defaultdict(int)
        new_contributors_by_year = defaultdict(int)
        active_contributors_by_month = defaultdict(set)
        active_contributors_by_year = defaultdict(set)

        # Collect all contributor activities with dates
        contributor_activities = []

        # From commits
        for commit in commits:
            author = commit.get("author")
            if author and author.get("login"):
                date_str = commit["commit"]["author"].get("date") if commit.get("commit") and commit["commit"].get("author") else None
                if date_str:
                    contributor_activities.append({
                        "login": author["login"],
                        "date": datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    })

        # From issues and PRs
        for issue in issues:
            user = issue.get("user")
            if user and user.get("login"):
                date_str = issue.get("created_at")
                if date_str:
                    contributor_activities.append({
                        "login": user["login"],
                        "date": datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    })

        # Sort by date to track first appearance
        contributor_activities.sort(key=lambda x: x["date"])

        # Process each activity
        for activity in contributor_activities:
            login = activity["login"]
            date = activity["date"]
            month_key = date.strftime("%Y-%m")
            year_key = str(date.year)

            # Track contributor data
            if contributor_data[login]["first_seen"] is None:
                contributor_data[login]["first_seen"] = date
                new_contributors_by_month[month_key] += 1
                new_contributors_by_year[year_key] += 1

            contributor_data[login]["last_seen"] = date
            contributor_data[login]["contribution_count"] += 1
            contributor_data[login]["contributions_by_period"][month_key] += 1

            # Track active contributors per period
            active_contributors_by_month[month_key].add(login)
            active_contributors_by_year[year_key].add(login)

        # Calculate metrics
        now = datetime.now(timezone.utc)
        one_time_contributors = 0
        repeat_contributors = 0
        active_3m = set()
        active_6m = set()
        active_12m = set()

        for login, data in contributor_data.items():
            # One-time vs repeat
            if data["contribution_count"] == 1:
                one_time_contributors += 1
            else:
                repeat_contributors += 1

            # Active vs inactive
            if data["last_seen"]:
                days_since_last = (now - data["last_seen"]).days
                if days_since_last <= 90:
                    active_3m.add(login)
                if days_since_last <= 180:
                    active_6m.add(login)
                if days_since_last <= 365:
                    active_12m.add(login)

        # Build cohort retention data
        cohorts = defaultdict(lambda: {
            "joined": set(),
            "retention": {}
        })

        for login, data in contributor_data.items():
            if data["first_seen"]:
                join_year = str(data["first_seen"].year)
                cohorts[join_year]["joined"].add(login)

        # Calculate retention for each cohort
        for cohort_year in sorted(cohorts.keys()):
            cohort_members = cohorts[cohort_year]["joined"]
            cohort_year_int = int(cohort_year)

            # Check activity in subsequent years
            for check_year in range(cohort_year_int, datetime.now().year + 1):
                check_year_str = str(check_year)
                active_in_year = active_contributors_by_year.get(check_year_str, set())
                still_active = cohort_members & active_in_year

                if cohort_members:
                    retention_rate = (len(still_active) / len(cohort_members)) * 100
                    cohorts[cohort_year]["retention"][check_year_str] = {
                        "count": len(still_active),
                        "rate": round(retention_rate, 1)
                    }

        # Convert cohorts to serializable format
        cohorts_data = {}
        for year, data in cohorts.items():
            cohorts_data[year] = {
                "joined": len(data["joined"]),
                "retention": data["retention"]
            }

        # Find consistently active contributors
        # Contributors active in at least 3 different years
        contributor_yearly_activity = defaultdict(set)
        for login, data in contributor_data.items():
            if data["contributions_by_period"]:
                for period in data["contributions_by_period"].keys():
                    year = period.split("-")[0]
                    contributor_yearly_activity[login].add(year)

        # Sort by number of years active and total contributions
        consistently_active = []
        for login, years_active in contributor_yearly_activity.items():
            if len(years_active) >= 2:  # Active in at least 2 years
                consistently_active.append({
                    "login": login,
                    "years_active": len(years_active),
                    "total_contributions": contributor_data[login]["contribution_count"],
                    "first_seen": contributor_data[login]["first_seen"].isoformat() if contributor_data[login]["first_seen"] else None,
                    "last_seen": contributor_data[login]["last_seen"].isoformat() if contributor_data[login]["last_seen"] else None,
                    "years": sorted(list(years_active))
                })

        # Sort by years active (descending), then by total contributions (descending)
        consistently_active.sort(key=lambda x: (x["years_active"], x["total_contributions"]), reverse=True)

        # Export top contributors' timeline data for stacked area chart
        # Get top contributors by total contributions
        top_contributors = sorted(
            contributor_data.items(),
            key=lambda x: x[1]["contribution_count"],
            reverse=True
        )[:30]  # Top 30 contributors

        contributor_timelines = {}
        for login, data in top_contributors:
            contributor_timelines[login] = {
                "total_contributions": data["contribution_count"],
                "first_seen": data["first_seen"].isoformat() if data["first_seen"] else None,
                "last_seen": data["last_seen"].isoformat() if data["last_seen"] else None,
                "contributions_by_month": dict(sorted(data["contributions_by_period"].items())),
                "is_core": login in CORE_MEMBERS
            }

        # Track issue burndown (open vs closed over time)
        # Separate bugs from other issues
        cumulative_open_by_month = {}
        cumulative_bugs_by_month = {}
        cumulative_other_by_month = {}

        real_issues = [issue for issue in issues if "pull_request" not in issue]

        # Helper function to check if issue is a bug
        def is_bug(issue):
            labels = issue.get("labels", [])
            return any(label.get("name", "").lower() in ["bug", "bugs"] for label in labels)

        # Track all issue state changes by month
        issue_events = []
        for issue in real_issues:
            is_bug_issue = is_bug(issue)

            # Track when opened
            created_at = issue.get("created_at")
            if created_at:
                date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                month_key = date.strftime("%Y-%m")
                issue_events.append({
                    "month": month_key,
                    "type": "open",
                    "is_bug": is_bug_issue
                })

            # Track when closed
            closed_at = issue.get("closed_at")
            if closed_at:
                date = datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
                month_key = date.strftime("%Y-%m")
                issue_events.append({
                    "month": month_key,
                    "type": "close",
                    "is_bug": is_bug_issue
                })

        # Sort events by month
        issue_events.sort(key=lambda x: x["month"])

        # Calculate cumulative counts
        all_months = sorted(set(event["month"] for event in issue_events))
        cumulative_open = 0
        cumulative_bugs = 0
        cumulative_other = 0

        for month in all_months:
            month_events = [e for e in issue_events if e["month"] == month]

            for event in month_events:
                if event["type"] == "open":
                    cumulative_open += 1
                    if event["is_bug"]:
                        cumulative_bugs += 1
                    else:
                        cumulative_other += 1
                else:  # close
                    cumulative_open -= 1
                    if event["is_bug"]:
                        cumulative_bugs -= 1
                    else:
                        cumulative_other -= 1

            cumulative_open_by_month[month] = max(0, cumulative_open)
            cumulative_bugs_by_month[month] = max(0, cumulative_bugs)
            cumulative_other_by_month[month] = max(0, cumulative_other)

        # Current state
        open_issues = len([i for i in real_issues if i.get("state") == "open"])
        closed_issues = len([i for i in real_issues if i.get("state") == "closed"])
        open_bugs = len([i for i in real_issues if i.get("state") == "open" and is_bug(i)])
        open_other = open_issues - open_bugs

    return {
        "by_month": {
            "new_contributors": dict(sorted(new_contributors_by_month.items())),
            "active_contributors": {k: len(v) for k, v in sorted(active_contributors_by_month.items())}
        },
        "by_year": {
            "new_contributors": dict(sorted(new_contributors_by_year.items())),
            "active_contributors": {k: len(v) for k, v in sorted(active_contributors_by_year.items())}
        },
        "totals": {
            "new_contributors": len(contributor_data),
            "one_time_contributors": one_time_contributors,
            "repeat_contributors": repeat_contributors,
            "active_3m": len(active_3m),
            "active_6m": len(active_6m),
            "active_12m": len(active_12m),
            "inactive": len(contributor_data) - len(active_12m)
        },
        "cohorts": cohorts_data,
        "consistently_active": consistently_active[:50],  # Top 50
        "contributor_timelines": contributor_timelines,
        "burndown": {
            "by_month": {
                "cumulative_open": dict(sorted(cumulative_open_by_month.items())),
                "cumulative_bugs": dict(sorted(cumulative_bugs_by_month.items())),
                "cumulative_other": dict(sorted(cumulative_other_by_month.items()))
            },
            "current": {
                "open": open_issues,
                "closed": closed_issues,
                "open_bugs": open_bugs,
                "open_other": open_other
            }
        }
    }

async def fetch_container_downloads(token: str = None) -> Dict:
    """Fetch container image info from ghcr-signer and GHCR.

    Uses the Git Trees API (1 call) to read the full ghcr-signer directory
    structure, then resolves architecture info via anonymous GHCR OCI
    manifest requests (which don't count against GitHub API rate limits).
    """
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        if token.startswith("ghp_"):
            headers["Authorization"] = f"token {token}"
        elif token.startswith("github_pat_"):
            headers["Authorization"] = f"Bearer {token}"
        else:
            headers["Authorization"] = f"token {token}"

    signer_repo = "freedomofpress/ghcr-signer"

    async with httpx.AsyncClient(headers=headers, timeout=60.0, follow_redirects=True) as client:
        # Step 1: Get the full repo tree in a single API call
        resp = await client.get(
            f"https://api.github.com/repos/{signer_repo}/git/trees/main",
            params={"recursive": "1"}
        )
        resp.raise_for_status()
        tree = resp.json().get("tree", [])

        # Parse the tree to find arch-specific digests (those WITHOUT a LATEST file).
        # Tree entries look like: SIGNATURES/<timestamp>/<digest>/<file>
        # Digests with LATEST are multi-arch indexes; without are arch-specific.
        batches_map = {}  # timestamp -> {digest -> set of files}
        for entry in tree:
            path = entry.get("path", "")
            if not path.startswith("SIGNATURES/"):
                continue
            parts = path.split("/")
            if len(parts) == 4:
                timestamp, digest, filename = parts[1], parts[2], parts[3]
                if len(digest) == 64 and all(c in '0123456789abcdef' for c in digest):
                    if timestamp not in batches_map:
                        batches_map[timestamp] = {}
                    if digest not in batches_map[timestamp]:
                        batches_map[timestamp][digest] = set()
                    batches_map[timestamp][digest].add(filename)

        # Build batches with only arch-specific digests (no LATEST file)
        batches = []
        for ts in sorted(batches_map.keys()):
            arch_digests = sorted([
                d for d, files in batches_map[ts].items()
                if "LATEST" not in files
            ])
            if arch_digests:
                batches.append({"timestamp": ts, "digests": arch_digests})

        # Step 2: Get an anonymous GHCR token (doesn't use GitHub API quota)
        ghcr_token = ""
        try:
            token_resp = await client.get(
                "https://ghcr.io/token?scope=repository:freedomofpress/dangerzone/v1:pull"
            )
            ghcr_token = token_resp.json().get("token", "")
        except Exception as e:
            print(f"Warning: Could not get GHCR token: {e}")

        # Step 3: For each arch-specific digest, resolve its architecture
        # via GHCR manifest + config blob (requests to ghcr.io, no API rate limit).
        # Run all lookups in parallel.
        all_digests = set()
        for batch in batches:
            for digest in batch["digests"]:
                all_digests.add(digest)

        async def resolve_image_info(digest):
            """Fetch manifest then config blob to determine architecture and total size.

            Total compressed size is computed from the manifest as the sum of the
            config blob size plus all layer blob sizes. This corresponds to the
            on-the-wire bytes pulled from the registry for that arch.
            """
            try:
                manifest_resp = await client.get(
                    f"https://ghcr.io/v2/freedomofpress/dangerzone/v1/manifests/sha256:{digest}",
                    headers={
                        "Authorization": f"Bearer {ghcr_token}",
                        "Accept": ", ".join([
                            "application/vnd.oci.image.manifest.v1+json",
                            "application/vnd.docker.distribution.manifest.v2+json",
                        ])
                    }
                )
                if manifest_resp.status_code == 200:
                    manifest = manifest_resp.json()
                    config = manifest.get("config", {})
                    config_digest = config.get("digest", "")
                    layers = manifest.get("layers", [])
                    total_size = config.get("size", 0) + sum(l.get("size", 0) for l in layers)
                    arch = "unknown"
                    if config_digest:
                        config_resp = await client.get(
                            f"https://ghcr.io/v2/freedomofpress/dangerzone/v1/blobs/{config_digest}",
                            headers={"Authorization": f"Bearer {ghcr_token}"}
                        )
                        if config_resp.status_code == 200:
                            arch = config_resp.json().get("architecture", "unknown")
                    return {"arch": arch, "size": total_size}
            except Exception as e:
                print(f"Warning: Could not fetch manifest for {digest[:12]}: {e}")
            return {"arch": "unknown", "size": 0}

        info_by_digest = {}
        if ghcr_token:
            sorted_digests = sorted(all_digests)
            results = await asyncio.gather(*[resolve_image_info(d) for d in sorted_digests])
            info_by_digest = dict(zip(sorted_digests, results))

        result_batches = []
        for batch in batches:
            batch_info = {
                "timestamp": batch["timestamp"],
                "images": [
                    {
                        "digest": d,
                        "arch": info_by_digest.get(d, {}).get("arch", "unknown"),
                        "size": info_by_digest.get(d, {}).get("size", 0),
                    }
                    for d in batch["digests"]
                ]
            }
            result_batches.append(batch_info)

        # Step 4: Scrape download counts from the GitHub package versions web pages.
        # The REST API does not expose download_count for container packages,
        # so we scrape the HTML instead (no API rate limit).
        download_counts = {}  # digest -> {"downloads": N, "url": str}
        pkg_url = "https://github.com/freedomofpress/dangerzone/pkgs/container/dangerzone%2Fv1/versions"

        page = 1
        max_pages = 40
        found_all = False
        while page <= max_pages and not found_all:
            try:
                resp = await client.get(
                    pkg_url,
                    params={"page": page},
                    headers={"Accept": "text/html"},
                    follow_redirects=True,
                )
                if resp.status_code != 200:
                    print(f"Warning: Package page returned {resp.status_code}")
                    break
                html = resp.text

                # Extract version URL, digest, and download count.
                # Real image entries have "sha256:" (colon) in the link text
                # and no ?tag= in the href, unlike .sig/.att tag entries.
                # The download count follows as bare text before a sr-only span.
                for m in re.finditer(
                    r'href="(/orgs/freedomofpress/packages/container/dangerzone%2Fv1/\d+)">'
                    r'sha256:([0-9a-f]{64})</a>'
                    r'.*?'
                    r'>\s*(\d+)\s*<span[^>]*>Version downloads</span>',
                    html,
                    re.DOTALL,
                ):
                    url_path = m.group(1)
                    digest = m.group(2)
                    count = int(m.group(3))
                    download_counts[digest] = {
                        "downloads": count,
                        "url": f"https://github.com{url_path}",
                    }

                if all_digests.issubset(download_counts.keys()):
                    found_all = True

                if 'Version downloads' not in html:
                    break

                page += 1
            except Exception as e:
                print(f"Warning: Failed to scrape package page {page}: {e}")
                break

        if download_counts:
            print(f"  Scraped download counts for {len(download_counts)} digests across {page} pages")
            found = all_digests & download_counts.keys()
            missing = all_digests - download_counts.keys()
            print(f"  Found counts for {len(found)}/{len(all_digests)} signed digests")
            if missing:
                print(f"  Missing: {[d[:12] for d in missing]}")

        # Attach download counts and URLs to batch images
        for batch in result_batches:
            for img in batch["images"]:
                info = download_counts.get(img["digest"], {})
                img["downloads"] = info.get("downloads", 0)
                img["url"] = info.get("url", "")

    return {
        "batches": result_batches,
    }


def generate_site(stats: ReleaseStats) -> None:
    """Generate the static site using the templates"""
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)

    templates_dir = Path("templates")
    templates_dir.mkdir(exist_ok=True)

    env = Environment(loader=FileSystemLoader("templates"))

    template = env.get_template("index.html")
    index_content = template.render(
        stats=stats,
        generated_at=datetime.now().isoformat()
    )
    
    with open(output_dir / "index.html", "w") as f:
        f.write(index_content)

    with open(output_dir / "stats.json", "w") as f:
        json.dump(stats, f)

async def main():
    repo = os.getenv("GITHUB_REPO", "freedomofpress/dangerzone")
    token = os.getenv("GITHUB_TOKEN")

    # Fetch release stats
    stats = await fetch_github_stats(repo, token)

    # Fetch contribution stats
    try:
        print("Fetching contribution data...")
        contributions = await fetch_contributions(repo, token)
        stats["contributions"] = contributions
        print(f"Successfully fetched contributions: {contributions['totals']}")
    except Exception as e:
        print(f"Warning: Failed to fetch contributions: {e}")
        import traceback
        traceback.print_exc()
        stats["contributions"] = {
            "by_month": {"new_contributors": {}, "active_contributors": {}},
            "by_year": {"new_contributors": {}, "active_contributors": {}},
            "totals": {
                "new_contributors": 0,
                "one_time_contributors": 0,
                "repeat_contributors": 0,
                "active_3m": 0,
                "active_6m": 0,
                "active_12m": 0,
                "inactive": 0
            },
            "cohorts": {},
            "consistently_active": [],
            "contributor_timelines": {},
            "burndown": {
                "by_month": {
                    "cumulative_open": {},
                    "cumulative_bugs": {},
                    "cumulative_other": {}
                },
                "current": {
                    "open": 0,
                    "closed": 0,
                    "open_bugs": 0,
                    "open_other": 0
                }
            }
        }

    # Fetch container image data
    try:
        print("Fetching container image data...")
        container_data = await fetch_container_downloads(token)
        stats["container_images"] = container_data
        print(f"Successfully fetched container data: {len(container_data['batches'])} signed batches")
    except Exception as e:
        print(f"Warning: Failed to fetch container data: {e}")
        import traceback
        traceback.print_exc()
        stats["container_images"] = {
            "batches": [],
        }

    generate_site(stats)

if __name__ == "__main__":
    asyncio.run(main())