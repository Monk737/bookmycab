/**
 * Pure impersonation record model (Epic 3).
 *
 * SCOPE: this module mints and validates the audited, read-only impersonation
 * MARKER only. It does NOT mint a real tenant session and does NOT render a
 * "view-as" dashboard, that binds in Epic 7. // TODO(epic-7)
 *
 * All functions are pure (no I/O, no clock reads): `now` is injected as an epoch
 * millisecond value so expiry math is deterministic and unit-testable.
 */

/** Read-only by default; write mode is opt-in and audited (Epic 29). */
export type ImpersonationMode = "read_only" | "write";

/** The 15-minute auto-expiry window for an impersonation session, in ms. */
export const IMPERSONATION_TTL_MS = 15 * 60 * 1000;

/**
 * A minted impersonation marker. Persisted as an httpOnly cookie (no real
 * session is created); the banner reads it to show the active state.
 */
export type ImpersonationRecord = {
  staffUserId: string;
  tenantId: string;
  targetUserId: string;
  /** Mandatory free-text reason (trimmed, non-empty). */
  reason: string;
  mode: ImpersonationMode;
  /** Epoch ms when impersonation began. */
  startedAt: number;
  /** Epoch ms at which the marker expires (startedAt + TTL). */
  expiresAt: number;
};

export type MintImpersonationInput = {
  staffUserId: string;
  tenantId: string;
  targetUserId: string;
  reason: string;
  /** Defaults to "read_only"; "write" must be chosen deliberately. */
  mode?: ImpersonationMode;
  /** Epoch ms "now"; injected for determinism. */
  now: number;
};

/**
 * Builds a read-only impersonation record expiring 15 minutes after `now`.
 *
 * The reason is MANDATORY: an empty or whitespace-only reason throws, so callers
 * cannot start an unattributed impersonation. The reason is stored trimmed.
 */
export function mintImpersonation(
  input: MintImpersonationInput,
): ImpersonationRecord {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new Error("Impersonation requires a non-empty reason.");
  }
  return {
    staffUserId: input.staffUserId,
    tenantId: input.tenantId,
    targetUserId: input.targetUserId,
    reason,
    mode: input.mode ?? "read_only",
    startedAt: input.now,
    expiresAt: input.now + IMPERSONATION_TTL_MS,
  };
}

/**
 * True while the record is still within its window. The boundary is exclusive:
 * at `now === expiresAt` the marker is already invalid (expired).
 */
export function isImpersonationValid(
  record: ImpersonationRecord,
  now: number,
): boolean {
  return now < record.expiresAt;
}

/**
 * The single gate future "view-as" write paths must call: returns true ONLY when
 * the impersonation is write-mode AND still within its window. Read-only and
 * expired markers always return false. Pure, `now` injected for determinism.
 */
export function impersonationAllowsWrite(record: ImpersonationRecord, now: number): boolean {
  return record.mode === "write" && isImpersonationValid(record, now);
}
