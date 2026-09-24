# DeepSeek Harness — GPT Permission Fix Fork

English | [中文](README.zh.md)

> **Personal-use notice:** This is an unofficial personal fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It is maintained for one user's local workflow and experiments. The changes are AI-assisted and may contain ugly, incomplete, or fragile code. There is no promise of stability, compatibility, security, or upstream acceptance. No warranty is provided, and the maintainer is not responsible for loss, damage, data exposure, or other consequences arising from use. Use it at your own risk.

## Why this fork exists

This fork keeps a small, long-lived patch on top of the official DeepSeek Harness source. The patch addresses a repeated permission-escalation loop seen when GPT/Codex uses the Bash, PowerShell, or filesystem tools: the initial tool schema exposed `sandbox_permissions` and `justification`, so a model could request elevation before a real sandbox denial had occurred.

The local fix changes that sequence without removing the real security boundary:

- The initial Bash, PowerShell, filesystem, and `run_code` schemas do not advertise `sandbox_permissions` or `justification`.
- A denial result supplies the retry hint only when a wider retry is actually available.
- Runtime calls still accept those fields for a denial-driven retry.
- Malformed, empty, same-level, and narrower requests keep the standing policy instead of creating a new error loop.
- A genuinely wider request still requires the existing approval service and user approval.
- Windows users can opt into a Git Bash launcher without changing the system's default PowerShell.

This is a compatibility fix, not a claim that the upstream model, provider, or all sandbox backends behave identically.

## Public-repository data rule

This repository must contain source code, tests, documentation, build helpers, and synchronization workflows only. Do **not** commit API keys, access tokens, private keys, certificates, cookies, chat history, session files, attachments, local storage, databases, logs, or personal configuration.

The repository's automation never reads a user's DSH home directory, credentials store, chat history, or runtime storage. `tools/check-public-tree.py` runs in CI and rejects high-confidence credential material and known runtime-data paths. The `.gitignore` file is a second line of defense, not a substitute for reviewing `git diff` before publishing.

## Run from Git Bash

Prerequisites: Node.js 22 or newer, Git for Windows with Git Bash, and pnpm.

```bash
# Git Bash / Linux / macOS
bash tools/dsh-git-bash.sh web

# Build the fixed source tree
bash tools/build-fixed.sh
pnpm dsh web
```

On Windows, the opt-in wrapper is:

```cmd
tools\dsh-git-bash.cmd web
```

These launchers do not replace or modify the system default PowerShell. They only provide an explicit Git Bash path for commands whose quoting is easier in Bash.

## Upstream synchronization

The upstream compatibility workflow checks the official `master` branch hourly and can also be started manually. It applies the local patch to a temporary upstream candidate, runs the public-hygiene check and focused sandbox tests, and uploads a patch artifact when upstream changes.

The default workflow is intentionally review-first: it does not mutate the public branch. If you later configure branch protection and decide that reviewed automation is appropriate, set the repository variable `DSH_AUTO_SYNC=true`; the workflow then opens a pull request instead of silently replacing the branch. A conflict fails the workflow and is reported by GitHub Actions.

For a local compatibility check, run from the public fix branch:

```bash
bash tools/sync-upstream.sh
```

Only `public-hygiene.yml` and `sync-upstream.yml` are active in `.github/workflows/`. The upstream release, E2E/API, deployment, publication, Issue-automation, and other secret-using workflow files are preserved under `.github/workflows-disabled/` and are not discovered by GitHub Actions. This fork does not configure their secrets.

GitHub's own mobile/email notifications can report the two active workflow failures. Do not put Microsoft, Google, QQ, SMTP credentials, GitHub tokens, or any other personal secret in this repository. Configure notifications in the GitHub account or repository settings instead.

## Development checks

```bash
python tools/check-public-tree.py
pnpm exec vitest run \
  packages/core/tools/tests/ptc.spec.ts \
  packages/sandbox/sandbox/tests/escalation.spec.ts \
  packages/shell/tool-bash/tests/tools.spec.ts \
  packages/shell/tool-pwsh/tests/tools.spec.ts \
  packages/fs/tool-fs/tests/tools.spec.ts \
  --reporter=dot
```

The focused tests cover schema hiding across native tools and `run_code`, denial-driven retries, malformed arguments, same-level requests, approval routing, and the shared filesystem/shell escalation path.

## Relationship to upstream

DeepSeek Harness remains the upstream project and the source of truth for the rest of the codebase. This fork is not an official DeepSeek distribution, does not speak for DeepSeek, and may fall behind or conflict with upstream changes. When the synchronization workflow reports a conflict, stop and review the conflict rather than force-applying the old patch.

## License

The upstream license and notices remain in [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The personal-use notice above describes the intended use of this fork; it does not replace the applicable open-source license.
