import type { ReactNode } from "react";
import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";
import { requireStaff } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Admin — CabbyBot",
  robots: { index: false, follow: false },
};

/**
 * Admin surface layout. Calls `requireStaff()` first as defense-in-depth on top
 * of the middleware staff gate, then renders the operational console shell.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaff();
  return <AdminShell banner={<ImpersonationBanner />}>{children}</AdminShell>;
}
