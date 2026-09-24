/**
 * The sandbox-escalation API shared by the `write` and `edit` tools: the
 * per-call policy resolution and the denial-marker
 * mapping — all delegating the vocabulary and the fail-closed approval
 * sequence to `@deepseek-ai/dsh-sandbox` (the same pieces `@deepseek-ai/dsh-tool-bash`
 * uses), so bash and fs escalate identically. Built ONCE per plugin from
 * `ctx.fs.sandboxMode` (the capability fact — is a confining backend mounted?)
 * and shared by both mutating tools.
 *
 * @module @deepseek-ai/dsh-tool-fs/sandbox
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { approveEscalation, escalationHintMarker, sandboxDenialMarker, validateEscalationArgs } from '@deepseek-ai/dsh-sandbox'
import type { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy'
import { FsError } from '@deepseek-ai/dsh-fs'

/** Runtime-only escalation arguments accepted on a denial-driven retry. */
export interface FsEscalationArgs {
  sandbox_permissions?: string
  justification?: string
}

/**
 * The filesystem escalation API: runtime availability, per-call policy
 * resolution, the one-approved wider retry, and denial-marker mapping. A pure
 * product of `ctx` at plugin apply time.
 */
export class FsSandboxController {
  /** Whether this composition can handle a denial-driven escalation retry. */
  private readonly escalationAvailable: boolean
  /** Shared per-session policy resolver, required by a confining backend. */
  private readonly policy: SandboxPolicyService | undefined

  constructor(private readonly ctx: Context) {
    const defaultMode = ctx.fs.sandboxMode
    this.escalationAvailable = defaultMode !== undefined
    this.policy = defaultMode === undefined ? undefined : ctx.get('sandboxPolicy')
    if (defaultMode !== undefined && this.policy === undefined) {
      throw new Error('tool-fs: the mounted filesystem confines but ctx.sandboxPolicy is missing')
    }
  }


  /**
   * The policy to stamp onto this mutation: an approved escalation grant (a
   * strictly wider retry resolved through `ctx.approval` before anything
   * executes), else the session's standing mode. Repeating the standing mode
   * requires no approval. The calling session's cwd is
   * always carried as the workspace root. Malformed optional escalation fields
   * leave the standing policy unchanged.
   * @param toolName - the mutating tool's name, for the approval audit trail.
   * @param args - the call's escalation arguments.
   * @param exec - the tool-execution context (agent, callId, signal).
   * @returns the policy to pass to the mutation, or undefined for an
   *   unsandboxed backend.
   */
  async resolvePolicy(toolName: string, args: FsEscalationArgs, exec: ToolExecution): Promise<SandboxExecutionPolicy | undefined> {
    const hasUsableEscalation = validateEscalationArgs(args.sandbox_permissions, args.justification)
    const standingPolicy = this.policy?.resolve({ ...exec.agent ? { session: exec.agent.session } : {} })
    if (!hasUsableEscalation) return standingPolicy
    if (!this.escalationAvailable) {
      throw new Error('sandbox_permissions is not available in this composition (no sandboxing filesystem to escalate)')
    }
    const policy = standingPolicy as SandboxExecutionPolicy
    const approvedMode = await approveEscalation(
      { requestedMode: args.sandbox_permissions, justification: args.justification, effectiveMode: policy.mode, subject: 'operation' },
      {
        approver: this.ctx.get('approval'),
        agent: exec.agent,
        callId: exec.callId,
        toolName,
        signal: exec.signal,
      },
    )
    return approvedMode === undefined ? policy : { ...policy, mode: approvedMode }
  }

  /**
   * Map a thrown provider error for the model: a `FS_SANDBOX_DENIED` becomes a
   * `FsError` whose text is the shared `[sandbox: …]` denial marker plus the
   * same-turn escalation hint, so a policy denial reads identically to bash's
   * WHILE keeping the structured `FS_SANDBOX_DENIED` code — `ToolRuntime`
   * populates `result.error` only for `HarnessError` instances, so a plain
   * `Error` would strip the code retry/observers key off. Any other error
   * passes through unchanged. A `FS_SANDBOX_DENIED` only arises under a
   * confining backend, where a denial can be retried through the shared
   * escalation path, so the hint applies here.
   * @param error - the error thrown by the mutation.
   * @param policy - the policy stamped onto the call (names the mode in the marker).
   * @returns the error to throw — the marker `FsError` for a sandbox denial, else the original.
   */
  mapError(error: unknown, policy: SandboxExecutionPolicy | undefined): unknown {
    if (!(error instanceof FsError) || error.code !== 'FS_SANDBOX_DENIED') return error
    // A FS_SANDBOX_DENIED only arises under a confining backend, whose tool
    // path always resolves a policy before mutation.
    const mode = (policy as SandboxExecutionPolicy).mode
    return new FsError(`${sandboxDenialMarker(mode)}\n${escalationHintMarker('operation')}`, 'FS_SANDBOX_DENIED', { cause: error })
  }
}
