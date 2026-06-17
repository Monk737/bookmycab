// src/app/admin/prompt-tuning/page.tsx
import type { Metadata } from "next";
import { requireStaff } from "@/lib/admin/guard";
import { getAdminInboxSuggestions, getActiveRevisions } from "@/lib/voice/prompt-tuning";
import { PromptRequestBoard } from "./prompt-request-board";

export const metadata: Metadata = { title: "Prompt tuning · Admin · BookMyCab" };
export const dynamic = "force-dynamic";

/**
 * FlowMo staff console for tenant-raised prompt-tuning requests. Staff review the
 * diff + evidence and apply (PATCH Vapi → versioned revision) or decline, and can
 * roll back any live revision. Tenants can only raise requests, never apply.
 */
export default async function AdminPromptTuningPage() {
  await requireStaff();
  const [requests, revisions] = await Promise.all([getAdminInboxSuggestions(), getActiveRevisions()]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Prompt tuning</h1>
        <p className="mt-1 text-sm text-gray-500">Approve and apply system-prompt changes — auto-detected by the daily sweep or raised by a tenant — with a reversible revision trail.</p>
      </header>
      <PromptRequestBoard requests={requests} revisions={revisions} />
    </div>
  );
}
