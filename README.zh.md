# DeepSeek Harness — GPT 提权修复个人 Fork

[English](README.md) | 中文

> **仅供个人使用的声明：** 这是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的非官方个人 Fork，只用于个人本地工作流和实验。本项目由 AI 辅助编写和维护，可能存在粗糙、不完整或脆弱的代码，也可能出现“屎山代码”。不保证稳定性、兼容性、安全性或会被上游接受；不提供任何担保。因使用本项目造成的损失、损坏、数据暴露或其他后果，维护者不承担责任。使用者自行承担全部风险。

## 为什么存在这个 Fork

这个 Fork 在官方 DeepSeek Harness 源码之上长期保留一组很小的兼容修复。修复针对的是 GPT/Codex 使用 Bash、PowerShell 或文件系统工具时反复提权的问题：初始工具 Schema 直接暴露了 `sandbox_permissions` 和 `justification`，模型可能在真正遇到沙箱拒绝之前就主动请求提权。

本地修复调整了这个顺序，但没有删除真实的安全边界：

- Bash、PowerShell、文件系统工具和 `run_code` 的初始 Schema 都不再暴露 `sandbox_permissions` 和 `justification`。
- 只有在工具实际返回拒绝结果、且确实存在更宽权限重试路径时，才给出重试提示。
- 运行时仍接受这两个字段，用于拒绝之后的重试。
- 参数格式错误、空值、同级权限和更窄权限请求保持当前 standing policy，不再制造新的错误循环。
- 真正扩大权限的请求仍然必须经过原有 approval service 和用户批准。
- Windows 用户可以选择 Git Bash 启动器，不修改系统默认 PowerShell。

这是兼容性修复，不代表上游模型、模型供应商或所有沙箱后端的行为完全相同。

## 公开仓库的数据规则

仓库中只能放源码、测试、文档、构建辅助脚本和同步 Workflow。**绝对不要**提交 API Key、访问令牌、私钥、证书、Cookie、聊天记录、session 文件、附件、本地存储、数据库、日志或个人配置。

仓库自动化不会读取用户的 DSH 主目录、凭据存储、聊天记录或运行时存储。`tools/check-public-tree.py` 会在 CI 中检查高置信度凭据和已知运行时数据路径；`.gitignore` 只是第二道防线，不能替代发布前对 `git diff` 的人工检查。

## 使用 Git Bash 运行

前置条件：Node.js 22 或更新版本、带 Git Bash 的 Git for Windows，以及 pnpm。

```bash
# Git Bash / Linux / macOS
bash tools/dsh-git-bash.sh web

# 构建修复后的源码
bash tools/build-fixed.sh
pnpm dsh web
```

Windows 上可以使用这个显式启动器：

```cmd
tools\dsh-git-bash.cmd web
```

这些启动器不会替换或修改系统默认 PowerShell，只是为容易受到 Bash 转义影响的命令提供一条显式 Git Bash 路径。

## 上游同步

上游兼容性 Workflow 每小时检查官方 `master` 分支，也可以手动运行。上游发生变化时，它会把本地修复应用到临时的上游候选树，运行公开仓库卫生检查和沙箱专项测试；如果有冲突，Workflow 失败并上传结果，而不是静默覆盖本地修复。

默认 Workflow 采用“先审查再合并”：不会修改公开分支。如果将来已经配置好分支保护，并且你确认允许自动化审查流程，可以设置仓库变量 `DSH_AUTO_SYNC=true`；此时 Workflow 会创建 Pull Request，而不是直接替换分支。冲突会让 Workflow 失败，等待人工处理。

本地可以在公开修复分支上运行：

```bash
bash tools/sync-upstream.sh
```

`.github/workflows/` 中只有 `public-hygiene.yml` 和 `sync-upstream.yml` 处于启用状态。上游的发布、E2E/API、部署、出版、Issue 自动化以及其他会使用 Secret 的 Workflow 被保存在 `.github/workflows-disabled/` 中，GitHub Actions 不会发现或运行它们。本 Fork 不配置这些 Secret。

GitHub 自己的手机通知或邮件通知可以报告这两个活动 Workflow 的失败。不要把微软、Google、QQ、SMTP 凭据、GitHub Token 或任何其他个人密钥放进仓库；通知应该在 GitHub 账户或仓库设置中配置。

## 开发检查

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

专项测试覆盖原生工具和 `run_code` 的 Schema 隐藏、拒绝驱动的重试、异常参数、同级权限请求、审批路由，以及文件系统和 Shell 之间共享的提权链路。

## 与上游的关系

DeepSeek Harness 仍是上游项目，也是其余代码的事实来源。本 Fork 不是 DeepSeek 官方发行版，不代表 DeepSeek 的立场，并且可能落后于上游或与上游冲突。同步 Workflow 报告冲突时，必须先审查冲突，不能强行套用旧修复。

## 许可证

上游许可证和第三方声明保留在 [LICENSE](LICENSE) 与 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 中。上面的个人使用声明描述的是本 Fork 的使用意图，不替代适用的开源许可证。
