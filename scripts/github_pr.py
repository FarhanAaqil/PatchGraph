"""Automated GitHub Pull Request & Merge Helper for PatchGraph phases.

Retrieves authentication dynamically via Git Credential Helper or GITHUB_TOKEN environment variable.
Never writes or hardcodes credentials.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import requests

REPO = "FarhanAaqil/PatchGraph"
BASE_URL = f"https://api.github.com/repos/{REPO}"


def resolve_token() -> str:
    env_token = os.environ.get("GITHUB_TOKEN")
    if env_token:
        return env_token.strip()

    try:
        proc = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\nusername=FarhanAaqil\n\n",
            capture_output=True,
            text=True,
            check=True,
        )
        for line in proc.stdout.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception as exc:
        print(f"Warning: could not retrieve credentials from git credential helper: {exc}")

    raise RuntimeError("GitHub authentication token not available via environment or credential helper.")


def create_and_merge_pr(title: str, body: str) -> None:
    token = resolve_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "PatchGraph-Automator",
    }

    print(f"Creating Pull Request: {title}")
    payload = {
        "title": title,
        "body": body,
        "head": "master",
        "base": "main",
    }
    resp = requests.post(f"{BASE_URL}/pulls", headers=headers, json=payload)
    if resp.status_code == 422 and "A pull request already exists" in resp.text:
        list_resp = requests.get(f"{BASE_URL}/pulls?head=FarhanAaqil:master&base=main", headers=headers)
        prs = list_resp.json()
        if prs:
            pr_number = prs[0]["number"]
            pr_url = prs[0]["html_url"]
            print(f"Using existing PR #{pr_number}: {pr_url}")
        else:
            print(f"Error fetching PR: {resp.text}")
            sys.exit(1)
    elif resp.status_code != 201:
        print(f"Failed to create PR ({resp.status_code}): {resp.text}")
        sys.exit(1)
    else:
        pr_data = resp.json()
        pr_number = pr_data["number"]
        pr_url = pr_data["html_url"]
        print(f"Successfully created PR #{pr_number}: {pr_url}")

    # Brief pause to allow GitHub to register commit refs
    time.sleep(2)

    merge_payload = {
        "commit_title": f"Merge pull request #{pr_number} from master: {title}",
        "commit_message": body,
        "merge_method": "merge",
    }
    merge_resp = requests.put(f"{BASE_URL}/pulls/{pr_number}/merge", headers=headers, json=merge_payload)
    if merge_resp.status_code == 200:
        print(f"Successfully merged PR #{pr_number} into main branch.")
    else:
        print(f"Merge response ({merge_resp.status_code}): {merge_resp.text}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python scripts/github_pr.py <title> <body>")
        sys.exit(1)
    create_and_merge_pr(sys.argv[1], sys.argv[2])
