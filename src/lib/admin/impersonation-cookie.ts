import "server-only";
import { cookies } from "next/headers";
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
 * Reads the active impersonation record from the httpOnly cookie, or null when
 * there is none, the cookie is corrupt, or the marker has expired. An expired
 * marker is treated as inactive (banner hidden). Pure-ish: reads cookies only.
 */
export async function readActiveImpersonation(): Promise<ImpersonationRecord | null> {
  const raw = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!raw) return null;

  let record: ImpersonationRecord;
  try {
    record = JSON.parse(raw) as ImpersonationRecord;
  } catch {
    return null;
  }

  if (
    typeof record?.expiresAt !== "number" ||
    typeof record?.tenantId !== "string" ||
    typeof record?.targetUserId !== "string"
  ) {
    return null;
  }

  if (!isImpersonationValid(record, Date.now())) return null;
  return record;
}
