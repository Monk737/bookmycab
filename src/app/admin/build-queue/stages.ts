// Plain shared constants for the build-queue Kanban. These live OUTSIDE
// actions.ts because that file is a "use server" module, which may only export
// async functions — exporting these arrays from there makes them non-iterable
// on the client (Runtime TypeError: BUILD_STAGES is not iterable).

export const BUILD_STAGES = [
  "Requested",
  "Scoped",
  "Building",
  "UAT",
  "Live",
] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

/**
 * The stages staff may set directly via the Kanban select. "Live" is excluded:
 * reaching Live MUST go through `goLive`, which sets build_stage='Live' AND
 * status='live' atomically. Letting the select set "Live" would move only the
 * pipeline stage and break the Live-stage ↔ live-status invariant.
 */
export const EDITABLE_BUILD_STAGES = [
  "Requested",
  "Scoped",
  "Building",
  "UAT",
] as const;
