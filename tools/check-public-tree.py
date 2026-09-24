#!/usr/bin/env python3
"""Reject personal runtime data and high-confidence credentials from a public tree.

The check only inspects files known to Git (tracked files plus non-ignored files),
so it does not walk a user's DSH home directory, sessions, or credentials store.
Synthetic test fixtures remain allowed; runtime-data directory names do not.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_COMPONENTS = {
    ".dsh", ".sessions", ".storages", "attachments", "chat-logs",
    "chat-records", "private-data", "runtime-data", "user-data",
}
FORBIDDEN_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".crt", ".cer", ".der",
    ".sqlite", ".sqlite-shm", ".sqlite-wal", ".db", ".db-shm", ".db-wal",
}
FORBIDDEN_NAMES = {".env", "credentials.json", "secrets.json"}
ACTIVE_WORKFLOWS = {"public-hygiene.yml", "sync-upstream.yml"}
SECRET_PATTERNS = (
    ("private-key", re.compile(r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----")),
    ("github-token", re.compile(r"\b(?:ghp|gho|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b")),
    ("openai-style-key", re.compile(r"\bsk-(?!e2efixture)[A-Za-z0-9]{20,}\b")),
    ("google-api-key", re.compile(r"\bAIza[A-Za-z0-9_-]{30,}\b")),
    ("aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
)


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    return [ROOT / item.decode("utf-8") for item in result.stdout.split(b"\0") if item]


def path_violation(path: Path) -> str | None:
    relative = path.relative_to(ROOT)
    if (
        len(relative.parts) >= 3
        and relative.parts[:2] == (".github", "workflows")
        and (len(relative.parts) != 3 or relative.name not in ACTIVE_WORKFLOWS)
    ):
        return "only allowlisted workflows may stay in .github/workflows"
    parts = {part.lower() for part in relative.parts}
    name = relative.name.lower()
    synthetic_fixture = 'snapshots' in parts or ('tests' in parts and 'fixtures' in parts)
    if parts & FORBIDDEN_COMPONENTS and not synthetic_fixture:
        return "runtime-data path"
    if name in FORBIDDEN_NAMES:
        return "credential file name"
    if any(name.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES):
        return "credential/database file extension"
    if name.startswith(".env") and not name.endswith(('.example', '.template')):
        return "environment file"
    return None


def main() -> int:
    violations: list[tuple[str, str]] = []
    for path in tracked_paths():
        if not path.is_file():
            continue
        reason = path_violation(path)
        if reason:
            violations.append((path.relative_to(ROOT).as_posix(), reason))
            continue
        try:
            data = path.read_bytes()
        except OSError as exc:
            print(f"public-hygiene: cannot read {path}: {exc}", file=sys.stderr)
            return 2
        if len(data) > 8 * 1024 * 1024 or b"\0" in data:
            continue
        text = data.decode("utf-8", errors="ignore")
        for label, pattern in SECRET_PATTERNS:
            if pattern.search(text):
                violations.append((path.relative_to(ROOT).as_posix(), label))
                break

    if violations:
        print("public-hygiene: forbidden personal data or credential material found:")
        for path, reason in violations:
            print(f"  - {path}: {reason}")
        return 1
    print("public-hygiene: no forbidden runtime data or high-confidence credentials found")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
