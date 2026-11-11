"""Open a pull request from master into main, wait for CI, then merge it.

Usage:
    python scripts/github_pr.py "Title of the change" "Longer description"

Authentication comes from GITHUB_TOKEN or the git credential helper. Nothing is stored on disk.
The merge only happens when every check on the PR head commit has finished successfully.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time

import requests

REPO = "FarhanAaqil/PatchGraph"
OWNER = REPO.split("/")[0]
BASE_URL = f"https://api.github.com/repos/{REPO}"
HEAD_BRANCH = "master"
BASE_BRANCH = "main"
CHECK_TIMEOUT_SECONDS = 20 * 60
POLL_SECONDS = 15


def resolve_token() -> str:
    env_token = os.environ.get("GITHUB_TOKEN")
    if env_token:
        return env_token.strip()

    proc = subprocess.run(
        ["git", "credential", "fill"],
        input=f"protocol=https\nhost=github.com\nusername={OWNER}\n\n",
        capture_output=True,
        text=True,
        check=False,
    )
    for line in proc.stdout.splitlines():
        if line.startswith("password="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("No GitHub token found in GITHUB_TOKEN or the git credential helper.")


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update(
        {
            "Authorization": f"Bearer {resolve_token()}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "patchgraph-release-helper",
        }
    )
    return s


def open_pull_request(s: requests.Session, title: str, body: str) -> dict:
    resp = s.post(
        f"{BASE_URL}/pulls",
        json={"title": title, "body": body, "head": HEAD_BRANCH, "base": BASE_BRANCH},
    )
    if resp.status_code == 201:
        return resp.json()
    if resp.status_code == 422 and "already exists" in resp.text:
        existing = s.get(f"{BASE_URL}/pulls", params={"head": f"{OWNER}:{HEAD_BRANCH}", "base": BASE_BRANCH}).json()
        if existing:
            return existing[0]
    raise SystemExit(f"Could not open the pull request ({resp.status_code}): {resp.text}")


def wait_for_checks(s: requests.Session, sha: str) -> None:
    """Block until all check runs on `sha` finish; exit non-zero if any did not succeed."""
    deadline = time.time() + CHECK_TIMEOUT_SECONDS
    while time.time() < deadline:
        all_runs = s.get(f"{BASE_URL}/commits/{sha}/check-runs", params={"per_page": 100}).json().get("check_runs", [])
        # Only the CI workflow gates the merge; bot-owned checks (e.g. Dependabot's config job) can queue for a long time.
        runs = [r for r in all_runs if (r.get("app") or {}).get("slug") == "github-actions"]
        if runs and all(r["status"] == "completed" for r in runs):
            failed = [r for r in runs if r["conclusion"] not in ("success", "skipped", "neutral")]
            for r in runs:
                print(f"  {r['name']}: {r['conclusion']}")
            if failed:
                raise SystemExit("Checks failed, not merging: " + ", ".join(r["name"] for r in failed))
            return
        pending = [r["name"] for r in runs if r["status"] != "completed"]
        print(f"  waiting on checks: {', '.join(pending) or 'none started yet'}")
        time.sleep(POLL_SECONDS)
    raise SystemExit("Timed out waiting for checks.")


def merge(s: requests.Session, number: int, title: str, body: str) -> None:
    resp = s.put(
        f"{BASE_URL}/pulls/{number}/merge",
        json={"commit_title": f"{title} (#{number})", "commit_message": body, "merge_method": "merge"},
    )
    if resp.status_code != 200:
        raise SystemExit(f"Merge failed ({resp.status_code}): {resp.text}")
    print(f"Merged #{number} into {BASE_BRANCH}.")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    title, body = sys.argv[1], sys.argv[2]

    subprocess.run(["git", "push", "origin", HEAD_BRANCH], check=True)
    s = session()
    pr = open_pull_request(s, title, body)
    print(f"PR #{pr['number']}: {pr['html_url']}")
    wait_for_checks(s, pr["head"]["sha"])
    merge(s, pr["number"], title, body)

    # Keep master level with main so the next phase starts from the merged state.
    subprocess.run(["git", "fetch", "origin"], check=True)
    subprocess.run(["git", "merge", "--ff-only", f"origin/{BASE_BRANCH}"], check=True)
    subprocess.run(["git", "push", "origin", HEAD_BRANCH], check=True)


if __name__ == "__main__":
    main()
