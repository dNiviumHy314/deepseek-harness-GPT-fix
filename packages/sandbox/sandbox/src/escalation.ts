/**
 * The escalation vocabulary and choreography shared by every sandbox-enforcing
 * tool family (`@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-fs`): the
 * strictly-wider ladder, the argument-pairing validation, the model-facing
 * denial/hint markers, and {@link approveEscalation} — the ordered fail-closed
 * sequence that resolves a `sandbox_permissions` request through a
 * user-approval channel BEFORE anything executes. One home keeps the two
 * families' approval ordering and verbatim error texts from drifting apart.
 *
 * The channel is a minimal STRUCTURAL function shape ({@link EscalationAsk}),
 * not the approval service type: the tool layer — which owns the agent, the
 * call id, and the tool name — closes over `ctx.approval.request(...)` and
 * hands the closure down, so this package never depends on the approval or
 * agent packages.
 *
 * @module dsh-sandbox/escalation
 */

import { assertNever } from '@deepseek-ai/dsh-util-values'
import type { SandboxMode } from './index.ts'

/**
 * The strictly-wider table: what a call whose effective mode is the key may
 * escalate to. Checked at execution because the effective mode is per-call
 * state. The target vocabulary is retained for runtime validation only.
 */
export const WIDER_MODES: Record<string, readonly SandboxMode[]> = {
  'read-only': ['workspace-write', 'danger-full-access'],
  'workspace-write': ['danger-full-access'],
}

/**
 * The closed escalation-target vocabulary — every mode a call could ever
 * escalate to (`read-only` is the floor; nothing escalates to it). It is used
 * for runtime validation and is deliberately absent from the initial schema.
 * The runtime set is kept closed so a session whose effective mode sits below
 * the composition default still has the full set of wider targets available.
 */
export const ESCALATION_TARGETS: readonly SandboxMode[] = ['workspace-write', 'danger-full-access']

const KNOWN_MODES: readonly SandboxMode[] = ['read-only', 'workspace-write', 'danger-full-access']

/** Return a complete, non-empty escalation pair or ignore model input noise. */
function usableEscalation(
  sandboxPermissions: unknown,
  justification: unknown,
): { requestedMode: string; justification: string } | undefined {
  if (typeof sandboxPermissions !== 'string' || sandboxPermissions.trim().length === 0) return undefined
  if (typeof justification !== 'string' || justification.trim().length === 0) return undefined
  return { requestedMode: sandboxPermissions, justification }
}

/**
 * Check the optional escalation pair. Malformed fields are treated as absent
 * so the caller keeps its standing policy instead of failing the tool call.
 * @param sandboxPermissions - the raw `sandbox_permissions` argument, if given.
 * @param justification - the raw `justification` argument, if given.
 * @returns `true` only when both fields form a usable escalation request.
 */
export function validateEscalationArgs(sandboxPermissions: unknown, justification: unknown): boolean {
  return usableEscalation(sandboxPermissions, justification) !== undefined
}

/**
 * The model-facing denial marker — the one vocabulary both enforcing families
 * teach and report, so the model recognizes a policy denial identically
 * whether the kernel refused a bash file effect or the filesystem provider's
 * fence refused a mutation.
 * @param mode - the mode the denied call ran under.
 * @returns the marker line, exactly as the model sees it.
 */
export function sandboxDenialMarker(mode: SandboxMode): string {
  return `[sandbox: file access denied under ${mode} mode]`
}

/**
 * The same-turn escalation hint that rides a denial when a wider retry is
 * available — the nudge lives at the decision point so
 * the sanctioned retry does not depend on the model recalling the tool
 * description.
 * @param subject - the family's noun for the denied action (`command` for
 *   bash, `operation` for a filesystem mutation).
 * @returns the hint line, exactly as the model sees it.
 */
export function escalationHintMarker(subject: string): string {
  return `[sandbox: escalation available — retry this exact ${subject} once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]`
}

/**
 * The closed outcome vocabulary of one escalation ask — structurally identical
 * to the approval seam's `ApprovalOutcome` so an `ApprovalService.request`
 * return is assignable without this package importing it.
 */
export type EscalationOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/**
 * The minimal approval-request shape {@link approveEscalation} needs —
 * structurally the approval seam's `ApprovalService`, generic over the agent
 * type `A` and call-id type `C` so this package resolves escalations through
 * `ctx.approval` without importing the approval or agent packages (the tool
 * layer infers `A`/`C` as its own `Agent`/`ToolCallId`).
 */
export interface EscalationApprover<A = object, C = string> {
  /**
   * Ask the human to approve one action, resolving to a closed outcome.
   * @param req - the audit-self-contained request (agent, tool, call id, reason, optional signal).
   * @returns the human's decision as a closed {@link EscalationOutcome}.
   */
  request(req: { agent: A; toolName: string; callId: C; reason: string; signal?: AbortSignal }): Promise<EscalationOutcome>
}

/**
 * The approval ingredients an escalating tool hands {@link approveEscalation}:
 * the approval requester (`ctx.approval`, or `undefined` when none is
 * composed), the calling agent (or `undefined` for an agent-less execution),
 * and the call's identity. The tool layer holds all of these; this package
 * only judges them.
 */
export interface EscalationApproval<A = object, C = string> {
  /** The approval requester (`ctx.approval`), or `undefined` when none is composed. */
  approver: EscalationApprover<A, C> | undefined
  /** The calling agent, or `undefined` for an agent-less execution (fails closed). */
  agent: A | undefined
  /** The tool-call id the approval prompt attaches to. */
  callId: C
  /** The tool name recorded on the approval request. */
  toolName: string
  /** The tool-execution abort signal the approval request rides, when present. */
  signal?: AbortSignal
}

/** One escalation request, as {@link approveEscalation} judges it. */
export interface EscalationRequest {
  /** The requested target mode, validated against the runtime vocabulary. */
  requestedMode?: unknown
  /** The model's one-sentence reason, shown verbatim to the user inside the audit reason. */
  justification?: unknown
  /** The call's effective mode (session override ?? composition default); repeating it needs no approval. */
  effectiveMode: SandboxMode
  /** The family's noun for the escalated action in user-facing texts (`command` for bash, `operation` for fs). */
  subject: string
}

/**
 * Resolve a sandbox permission request before execution. Repeating the call's
 * effective mode returns it without approval. A strictly wider mode requires
 * approval and applies only to this call. Narrower or unsupported targets,
 * missing approval services or agents for widening, and non-grant outcomes
 * throw before execution.
 * @param request - the escalation to judge (see {@link EscalationRequest}).
 * @param approval - the approval ingredients the tool holds (see {@link EscalationApproval}).
 * @returns the granted mode, consumed by the one call that asked.
 */
export async function approveEscalation<A, C>(
  request: EscalationRequest,
  approval: EscalationApproval<A, C>,
): Promise<SandboxMode | undefined> {
  const { requestedMode: rawMode, effectiveMode, justification: rawJustification, subject } = request
  const usable = usableEscalation(rawMode, rawJustification)
  if (usable === undefined) return undefined
  const { requestedMode: mode, justification } = usable
  // An invalid effective mode is a corrupt policy state and remains fail-closed.
  if (!KNOWN_MODES.includes(effectiveMode)) {
    throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`)
  }
  // Same-level and narrower requests do not need approval and do not fail the call.
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode as SandboxMode)) return undefined
  if (approval.approver === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`)
  }
  if (approval.agent === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`)
  }
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    ...approval.signal ? { signal: approval.signal } : {},
  })
  switch (outcome) {
    case 'allowed-once': return mode as SandboxMode
    case 'rejected': throw new Error(`the user rejected escalating this ${subject} to "${mode}"`)
    case 'cancelled': throw new Error(`approval for escalating to "${mode}" was cancelled`)
    case 'unavailable': throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`)
    default: return assertNever(outcome, 'EscalationOutcome')
  }
}
