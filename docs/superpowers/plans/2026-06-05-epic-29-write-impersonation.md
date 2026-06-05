# Epic 29: Write-scoped Impersonation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing audited, time-boxed impersonation **marker** to support an explicit **`write` mode** for support — read-only stays the default; write requires a deliberate selection + reason and is audited distinctly. Ship the pure **enforcement primitive** (`impersonationAllowsWrite`) that future write paths gate on. Admin-only (`requireStaff`).

**Architecture & honest scope:** Today's impersonation (Epic 3) mints a **signed httpOnly marker only** — it does NOT create a live "view-as" tenant session (that binding was deferred). So there is no live tenant write path to gate yet. This epic therefore extends the **model + cookie + admin UI + audit + enforcement primitive** so write-scoped impersonation is fully defined, validated, and audited — and documents that wiring it into an actual view-as write session is the remaining dependency. No new tables; no change to the signed-cookie crypto (the mode rides inside the already-signed record). Security properties preserved: mandatory reason, 15-min TTL, fail-closed audit, signature-verified cookie.

**Tech Stack:** TypeScript, Next.js App Router (server action), Vitest. Builds on Epic 3 (impersonation model/cookie/action/`requireStaff`, `writeAudit`).

**Dependencies:** Epic 3. Mirrors the established epic structure; no migration.

---

## File Map

### Modified — Model + enforcement
- `src/lib/admin/impersonation.ts` — `ImpersonationMode` union (`read_only | write`); `mintImpersonation` accepts `mode`; new pure `impersonationAllowsWrite(record, now)`

### Modified — Action + UI
- `src/app/admin/impersonate/actions.ts` — `startSchema` gains `mode` (enum, default `read_only`); pass to mint; audit the mode; distinct audit action for write
- `src/app/admin/impersonate/start-control.tsx` — mode selector (read-only default; "Allow writes" requires explicit choice)
- `src/app/admin/impersonate/page.tsx` — copy update (no longer "always read-only")

### Test files
- `tests/admin-impersonation.test.ts` — EXTEND: mode in mint + `impersonationAllowsWrite`
- `tests/admin-impersonation-cookie.test.ts` — EXTEND: a write-mode record round-trips through serialize/verify with mode intact

---

## Task 1: Model — write mode + enforcement primitive

**Files:** Modify `src/lib/admin/impersonation.ts`; extend `tests/admin-impersonation.test.ts`

- [ ] **Step 1: Read the current files**

Read `src/lib/admin/impersonation.ts` (the full model) and `tests/admin-impersonation.test.ts` (the existing pure tests) so the edits and new tests fit the established style.

- [ ] **Step 2: Add failing tests to `tests/admin-impersonation.test.ts`**

Append these tests (adapt imports to the existing test file's import block — it already imports from `@/lib/admin/impersonation`):

```typescript
import { impersonationAllowsWrite } from "@/lib/admin/impersonation";

describe("write-scoped impersonation", () => {
  const base = { staffUserId: "s1", tenantId: "t1", targetUserId: "u1", reason: "support ticket #42", now: 1_000 };

  it("mints read_only by default", () => {
    expect(mintImpersonation(base).mode).toBe("read_only");
  });
  it("mints write mode when requested", () => {
    expect(mintImpersonation({ ...base, mode: "write" }).mode).toBe("write");
  });
  it("still requires a non-empty reason in write mode", () => {
    expect(() => mintImpersonation({ ...base, mode: "write", reason: "  " })).toThrow();
  });
  it("impersonationAllowsWrite: true only for a valid write-mode record", () => {
    const rec = mintImpersonation({ ...base, mode: "write" });
    expect(impersonationAllowsWrite(rec, rec.startedAt + 1)).toBe(true);
  });
  it("impersonationAllowsWrite: false for read_only", () => {
    const rec = mintImpersonation(base);
    expect(impersonationAllowsWrite(rec, rec.startedAt + 1)).toBe(false);
  });
  it("impersonationAllowsWrite: false once expired even in write mode", () => {
    const rec = mintImpersonation({ ...base, mode: "write" });
    expect(impersonationAllowsWrite(rec, rec.expiresAt)).toBe(false);
  });
});
```

(`mintImpersonation` is already imported in this test file.)

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/admin-impersonation.test.ts` — Expected: FAIL (mode arg + `impersonationAllowsWrite` don't exist yet).

- [ ] **Step 4: Edit `src/lib/admin/impersonation.ts`**

(a) Replace the mode type:
```typescript
/** Read-only (default) or write-scoped support impersonation. */
export type ImpersonationMode = "read_only" | "write";
```

(b) Add `mode` to `MintImpersonationInput` (optional, defaults read_only):
```typescript
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
```

(c) In `mintImpersonation`, set the mode from input (default read_only) — replace the hard-coded `mode: "read_only",`:
```typescript
    mode: input.mode ?? "read_only",
```

(d) Add the pure enforcement primitive at the end of the file:
```typescript
/**
 * The single gate future "view-as" write paths must call: returns true ONLY when
 * the impersonation is write-mode AND still within its window. Read-only and
 * expired markers always return false. Pure — `now` injected for determinism.
 */
export function impersonationAllowsWrite(record: ImpersonationRecord, now: number): boolean {
  return record.mode === "write" && isImpersonationValid(record, now);
}
```

Also update the file's top doc comment line `/** Impersonation is always read-only this epoch. */` → `/** Read-only by default; write mode is opt-in and audited (Epic 29). */`.

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/admin-impersonation.test.ts` — Expected: PASS (existing tests + 6 new).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/admin/impersonation.ts tests/admin-impersonation.test.ts
git commit -m "feat(admin): write-mode impersonation model + impersonationAllowsWrite primitive"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 2: Action audits mode + cookie round-trip + UI selector

**Files:** Modify `src/app/admin/impersonate/actions.ts`, `start-control.tsx`, `page.tsx`; extend `tests/admin-impersonation-cookie.test.ts`

- [ ] **Step 1: Add a failing cookie round-trip test**

Read `tests/admin-impersonation-cookie.test.ts`, then append a test asserting a write-mode record survives serialize → verify with `mode === "write"` intact:

```typescript
it("preserves write mode through serialize → verify", () => {
  const rec = mintImpersonation({ staffUserId: "s1", tenantId: "t1", targetUserId: "u1", reason: "fixing booking", mode: "write", now: 5_000 });
  const round = verifyImpersonation(serializeImpersonation(rec));
  expect(round?.mode).toBe("write");
});
```

(Adapt imports to the file's existing block — it already imports `serializeImpersonation`/`verifyImpersonation`; add `mintImpersonation` from `@/lib/admin/impersonation` if not present, plus whatever signing-key arg the existing tests pass to verify/serialize — match the existing call style exactly.)

- [ ] **Step 2: Run to verify it fails (or passes if cookie already carries mode)**

Run: `npx vitest run tests/admin-impersonation-cookie.test.ts`
Expected: it should PASS even before action changes IF `mintImpersonation` accepts `mode` (Task 1) and the cookie serializes the whole record — confirm. If it FAILS, the serializer drops fields; fix `serializeImpersonation` to include the full record (it likely already JSON-stringifies the whole record, so no change needed). Report which.

- [ ] **Step 3: Update `src/app/admin/impersonate/actions.ts`**

Read the file. Then:
(a) Extend `startSchema` to include mode:
```typescript
  mode: z.enum(["read_only", "write"]).default("read_only"),
```
(b) In `safeParse({...})`, add `mode: formData.get("mode")`.
(c) Destructure `mode` from `parsed.data` and pass it to `mintImpersonation({ ..., mode, now: Date.now() })`.
(d) In the `writeAudit` call, set the action to reflect the mode and include it in metadata:
```typescript
    action: mode === "write" ? "impersonate.start.write" : "impersonate.start",
    ...
    metadata: { tenantId, targetUserId, reason, mode },
```
Keep the fail-closed audit behaviour exactly as-is.

- [ ] **Step 4: Update `src/app/admin/impersonate/start-control.tsx`**

Read the file (the impersonation start form). Add a mode control before the submit button — a checkbox that submits `mode`:
```tsx
<label className="flex items-center gap-2 text-sm text-slate-700">
  <input type="hidden" name="mode" value="read_only" />
  <input type="checkbox" name="mode" value="write" />
  Allow writes (write-scoped — use only when a fix requires it; fully audited)
</label>
```
(The hidden `read_only` before the checkbox means an unchecked box submits `read_only` and a checked box submits `write`; the action reads `formData.get("mode")` which returns the LAST value — so if the form posts both, read the last. NOTE: `FormData.get` returns the FIRST value, so instead read it as `const modeRaw = formData.getAll("mode"); const mode = modeRaw.includes("write") ? "write" : "read_only";` in the action — adjust step 3(b)/(c) accordingly to use `getAll`.)

- [ ] **Step 5: Update copy in `src/app/admin/impersonate/page.tsx`**

Read the file; change the "read-only, 15-minute" description to note write mode is available and audited, e.g. "Start an audited, 15-minute impersonation. Read-only by default; tick *Allow writes* only when a fix requires it — write actions are audited distinctly."

- [ ] **Step 6: Run tests + typecheck + build**

Run: `npx vitest run tests/admin-impersonation.test.ts tests/admin-impersonation-cookie.test.ts && npx tsc --noEmit && npx next build 2>&1 | tail -6`
Expected: all pass; compiles.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/impersonate tests/admin-impersonation-cookie.test.ts
git commit -m "feat(admin): impersonate UI mode selector + audit write mode distinctly"
```
Append after a blank line: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## Task 3: Integration gate

- [ ] **Step 1: Impersonation tests + full typecheck**

Run: `npx vitest run tests/admin-impersonation.test.ts tests/admin-impersonation-cookie.test.ts && npx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 2: Full suite**

Run: `npm test` — Expected: all pass except the known `engine-client.integration.test.ts` timeouts.

- [ ] **Step 3: Commit (if anything adjusted)**

```bash
git add -A && git commit -m "test(admin): write-impersonation gate green" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Write mode in the impersonation model | Task 1 |
| Reason mandatory + TTL preserved in write mode | Task 1 (reused) |
| Pure enforcement primitive (`impersonationAllowsWrite`) | Task 1 |
| Mode survives the signed cookie | Task 2 |
| Distinct audit for write mode (fail-closed) | Task 2 |
| Admin UI mode selector (read-only default) | Task 2 |
| Admin-only (`requireStaff`) | (existing on the action) |

**Placeholder scan:** none.

**Security review (built in):** write mode is opt-in (default read_only); reason stays mandatory (model throws on empty); 15-min TTL unchanged; the cookie remains signature-verified (mode is inside the signed payload, so it can't be forged); the audit is fail-closed (no session without an audit row) and records the mode distinctly. The enforcement primitive denies on read-only AND on expiry.

**Known limitation (documented, important):** this epic defines + validates + audits write-scoped impersonation, but the codebase does **not yet bind a live "view-as" tenant session** (deferred since Epic 3). Until that binding exists, no tenant write actually executes under impersonation — `impersonationAllowsWrite` is the ready-to-use gate the future view-as write path MUST call before permitting any mutation. Wiring that path (and writing each impersonated mutation to the audit log) is the follow-up; this epic ensures the model/UI/audit are correct and tested so that follow-up is purely a wiring exercise, not a security redesign.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-05-epic-29-write-impersonation.md`.

**3 tasks, no migration. Task 1 (model) gates 2; 3 last.**
