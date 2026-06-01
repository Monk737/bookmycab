import "server-only";
// The audit ledger is shared by the admin console and the control plane.
// Re-export the canonical writer so control-plane code doesn't import from admin/.
export { writeAudit } from "@/lib/admin/audit";
