#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
FIXED_REPOSITORY_URL="${DSH_FIXED_REPOSITORY_URL:-https://github.com/dNiviumHy314/deepseek-harness-GPT-fix.git}"
FIXED_REPOSITORY_REF="${DSH_FIXED_REPOSITORY_REF:-master}"
FIXED_REMOTE="fixed"

cd "$ROOT"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "fixed-update: not inside a Git worktree" >&2
  exit 2
fi

if [[ "$(git rev-parse --show-toplevel)" != "$ROOT" ]]; then
  echo "fixed-update: repository root mismatch: expected $ROOT" >&2
  exit 2
fi

current_branch="$(git branch --show-current)"
if [[ -z "$current_branch" ]]; then
  echo "fixed-update: refuse to update from detached HEAD" >&2
  exit 2
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "fixed-update: refuse to update with local file changes" >&2
  exit 3
fi

if git remote get-url "$FIXED_REMOTE" >/dev/null 2>&1; then
  configured_url="$(git remote get-url "$FIXED_REMOTE")"
  if [[ "$configured_url" != "$FIXED_REPOSITORY_URL" ]]; then
    git remote set-url "$FIXED_REMOTE" "$FIXED_REPOSITORY_URL"
  fi
else
  git remote add "$FIXED_REMOTE" "$FIXED_REPOSITORY_URL"
fi

git fetch --no-tags "$FIXED_REMOTE" "$FIXED_REPOSITORY_REF"
target="${FIXED_REMOTE}/${FIXED_REPOSITORY_REF}"
current_sha="$(git rev-parse HEAD)"
target_sha="$(git rev-parse "$target")"

if [[ "$current_sha" == "$target_sha" ]]; then
  echo "fixed-update: already current at $target_sha"
  exit 0
fi

if git merge-base --is-ancestor HEAD "$target"; then
  git merge --ff-only "$target"
  echo "fixed-update: advanced to $target_sha"
  pnpm install --frozen-lockfile
  exit 0
fi

if git merge-base --is-ancestor "$target" HEAD; then
  echo "fixed-update: local checkout is ahead of $target; no downgrade performed"
  exit 0
fi

echo "fixed-update: local checkout and $target have diverged; refusing to overwrite either side" >&2
exit 4
