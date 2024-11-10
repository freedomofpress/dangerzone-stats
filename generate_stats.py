#!/usr/bin/env -S uv run
# Needs "uv" to be run. chmod +x and then ./generate_stats.py
# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "jinja2", "httpx"
# ]
# ///
import os
import json
from pathlib import Path
from datetime import datetime
from jinja2 import Environment, FileSystemLoader
import httpx
from typing import Dict, List, TypedDict

class ReleaseStats(TypedDict):
    releases: List[Dict]

async def fetch_github_stats(repo: str) -> ReleaseStats:
    """Fetch GitHub release statistics"""
    async with httpx.AsyncClient() as client:
        # Fetch releases with download counts
        releases_resp = await client.get(
            f"https://api.github.com/repos/{repo}/releases"
        )
        releases = releases_resp.json()
        
        # Process releases to include download counts per asset
        processed_releases = []
        for release in releases:
            processed_releases.append({
                "name": release["name"] or release["tag_name"],
                "published_at": release["published_at"],
                "html_url": release["html_url"],
                "assets": [{
                    "name": asset["name"],
                    "download_count": asset["download_count"],
                    "download_url": asset["browser_download_url"]
                } for asset in release["assets"]]
            })

    return {
        "releases": processed_releases
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
    stats = await fetch_github_stats(repo)
    generate_site(stats)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())