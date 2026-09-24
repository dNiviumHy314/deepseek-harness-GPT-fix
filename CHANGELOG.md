# Changelog

## 2026-09-24

- Fixed GitHub Actions dependency setup by installing pnpm before setup-node cache initialization.
- Ported the permission/escalation fix onto the clean official upstream baseline without cherry-picking unrelated private history.
- Hid premature escalation fields from Bash, PowerShell, filesystem, and `run_code` schemas while preserving denial-driven, approval-gated retries.
- Added focused regression coverage; 4 test files and 293 tests pass, and `pnpm run typecheck` passes.
- Added bilingual personal-use documentation, public-tree hygiene checks, Git Bash launchers, and fail-closed hourly upstream compatibility workflows.
- No remote visibility change, push, force-push, deletion, or credential access was performed.
- Moved candidate dependency installation after the upstream patch is applied so compatibility tests use the candidate lockfile and source tree.
- Made the bilingual disclaimer explicit that this AI-maintained personal fork provides no warranty and accepts no responsibility for consequences of use.
- Moved all inherited release, E2E/API, deployment, publication, Issue-automation, and other secret-using workflows under `.github/workflows-disabled/`; only public hygiene and upstream compatibility workflows remain active.
- Added a workflow allowlist to `tools/check-public-tree.py` so unexpected files under `.github/workflows/` fail validation.
- Updated the two stale Bash escalation tests to assert that blank or whitespace-only injected justifications are ignored and execute under the standing sandbox policy; focused suite remains 293/293 passing.
- Pushed commit `1e8978cc37` from `public-gpt-fix` to the public Fork using Git Bash; push and pull-request focused workflows passed. The inherited `weighted-approval` check remains pending separately.
- Fixed the default-branch upstream compatibility workflow to create the pnpm store before setup-node cache initialization, preventing false failures during no-upstream-change runs.
