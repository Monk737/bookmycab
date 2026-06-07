import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/env";
import {
  isImpersonationValid,
  type ImpersonationRecord,
} from "@/lib/admin/impersonation";

/**
 * Cookie name for the read-only impersonation marker. Duplicated from the
 * action module so this server-read helper does not import the `"use server"`
 * actions file (which would pull server-action wiring into a plain read).
 */
export const IMPERSONATION_COOKIE = "cabby_impersonation";

/**
 * Server-only HMAC key for the marker signature. We reuse the service-role key:
 * it is already server-only, always present, and never reaches the client. The
 * signature is what makes the cookie authentic, a staff user cannot edit the
 * payload (e.g. extend `expiresAt` or swap ids) in DevTools without producing a
 * matching HMAC, which they cannot, because the key never leaves the server.
 * This is also what lets Epic 7 trust this record to mint a real "view-as"
 * session: only a server-signed marker is honoured. // TODO(epic-7)
 */
const SIGNING_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(payload: string): Buffer {
  return createHmac("sha256", SIGNING_KEY).update(payload).digest();
}

/**
 * Serializes a record into the signed cookie value `${payload}.${sig}`, where
 * `payload` is base64url(JSON) and `sig` is base64url(HMAC-SHA256(payload)).
 */
export function serializeImpersonation(record: ImpersonationRecord): string {
  const payload = base64url(Buffer.from(JSON.stringify(record), "utf8"));
  const sig = base64url(hmac(payload));
  return `${payload}.${sig}`;
}

/**
 * Verifies + parses a signed cookie value. Returns the record only when the
 * signature is authentic AND the shape is complete; otherwise null. Pure (no
 * I/O, no clock) so the verify path is unit-testable without next/headers. The
 * caller applies the expiry check separately.
 */
export function verifyImpersonation(
  value: string,
): ImpersonationRecord | null {
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!payload || !sig) return null;

  // Recompute and compare in constant time. A length mismatch (e.g. a forged
  // sig of the wrong size) cannot reach timingSafeEqual, so guard it first.
  const expected = hmac(payload);
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  let record: ImpersonationRecord;
  try {
    record = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ImpersonationRecord;
  } catch {
    return null;
  }

  // Shape guard (defense-in-depth, a tampered record fails the HMAC check
  // above first, but a complete guard rejects malformed records regardless).
  if (
    typeof record?.expiresAt !== "number" ||
    typeof record?.tenantId !== "string" ||
    typeof record?.targetUserId !== "string" ||
    typeof record?.staffUserId !== "string" ||
    typeof record?.reason !== "string"
  ) {
    return null;
  }

  return record;
}

/**
 * Reads the active impersonation record from the httpOnly cookie, or null when
 * there is none, the signature does not verify, the cookie is corrupt, or the
 * marker has expired. An expired marker is treated as inactive (banner hidden).
 */
export async function readActiveImpersonation(): Promise<ImpersonationRecord | null> {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  const record = verifyImpersonation(raw);
  if (!record) return null;

  if (!isImpersonationValid(record, Date.now())) return null;
  return record;
}
