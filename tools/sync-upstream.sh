#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
UPSTREAM_URL="${DSH_UPSTREAM_URL:-https://github.com/deepseek-ai/deepseek-harness.git}"
UPSTREAM_BRANCH="${DSH_UPSTREAM_BRANCH:-master}"
cd "$ROOT"

git remote get-url upstream >/dev/null 2>&1 || git remote add upstream "$UPSTREAM_URL"
git fetch --no-tags upstream "$UPSTREAM_BRANCH"

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "sync-upstream: refuse to run from detached HEAD; check out the public fix branch first" >&2
  exit 2
fi

BASE="$(git merge-base HEAD "upstream/$UPSTREAM_BRANCH")"
UPSTREAM_HEAD="$(git rev-parse "upstream/$UPSTREAM_BRANCH")"
if [[ "$BASE" == "$UPSTREAM_HEAD" ]]; then
  echo "sync-upstream: upstream has no new commits"
  exit 0
fi

PATCH_DIR="$(mktemp -d)"
CHECKOUT="$(mktemp -d)"
cleanup() {
  git worktree remove --force "$CHECKOUT" >/dev/null 2>&1 || true
  rm -rf "$PATCH_DIR" "$CHECKOUT"
}
trap cleanup EXIT

git diff --binary "$BASE..HEAD" > "$PATCH_DIR/local-fix.patch"
git worktree add --detach "$CHECKOUT" "upstream/$UPSTREAM_BRANCH" >/dev/null
if ! git -C "$CHECKOUT" apply --3way --index "$PATCH_DIR/local-fix.patch"; then
  echo "sync-upstream: conflict while applying local fix; the current checkout was not changed" >&2
  exit 1
fi

python "$CHECKOUT/tools/check-public-tree.py"
echo "sync-upstream: local fix applies cleanly to upstream/$UPSTREAM_BRANCH"
echo "sync-upstream: focused tests are run by .github/workflows/sync-upstream.yml"
