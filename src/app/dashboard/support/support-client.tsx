"use client";

import { useRef, useState } from "react";
import { DataTable } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatDateTime, truncateId } from "@/lib/dashboard/format";
import type { TicketRow } from "@/lib/dashboard/support-queries";

const TZ = "Europe/London";

const CATEGORIES = [
  { label: "Technical", value: "technical" },
  { label: "Billing", value: "billing" },
  { label: "Build request", value: "build_request" },
  { label: "Other", value: "other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

interface SupportClientProps {
  orgId: string;
  initialTickets: TicketRow[];
}

export function SupportClient({ orgId, initialTickets }: SupportClientProps) {
  const [tickets, setTickets] = useState<TicketRow[]>(initialTickets);

  // Form state
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  function prefillBuildRequest() {
    setCategory("build_request");
    setSubject("Request a new automation — ");
    setSuccessMsg(null);
    setErrorMsg(null);
    // Scroll to and focus the subject field
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      subjectRef.current?.focus();
    }, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!subject.trim()) {
      setErrorMsg("Subject is required.");
      return;
    }
    if (!category) {
      setErrorMsg("Please select a category.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Description is required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/support`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), category, description: description.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; id?: string; error?: string };

      if (!res.ok) {
        setErrorMsg(json.error ?? "Failed to submit ticket. Please try again.");
        return;
      }

      // Prepend the new ticket optimistically
      const newTicket: TicketRow = {
        id: json.id ?? crypto.randomUUID(),
        tenantId: orgId,
        automationId: null,
        createdBy: null,
        subject: subject.trim(),
        category,
        description: description.trim(),
        status: "open",
        createdAt: new Date().toISOString(),
      };
      setTickets((prev) => [newTicket, ...prev]);

      // Reset form
      setSubject("");
      setCategory("");
      setDescription("");
      setSuccessMsg("Ticket created. Your CabbyBot contact will be in touch.");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6 lg:p-8">
      <h1 className="font-mono text-xl font-semibold text-blue-900">Support</h1>

      {/* External knowledge base link */}
      <div>
        <a
          href="https://help.cabbybot.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-800 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Knowledge Base
        </a>
      </div>

      {/* Open tickets */}
      <section aria-labelledby="tickets-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="tickets-heading"
            className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500"
          >
            Your tickets
          </h2>
          <button
            type="button"
            onClick={prefillBuildRequest}
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 cursor-pointer"
          >
            Request a new automation
          </button>
        </div>
        <DataTable<TicketRow>
          columns={[
            {
              key: "id",
              header: "ID",
              render: (r) => (
                <span className="font-mono text-xs text-slate-500">{truncateId(r.id)}</span>
              ),
            },
            { key: "subject", header: "Subject", render: (r) => r.subject },
            {
              key: "category",
              header: "Category",
              render: (r) =>
                r.category
                  ? CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category
                  : "—",
            },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={r.status} />,
            },
            {
              key: "created",
              header: "Created",
              render: (r) => (
                <span className="whitespace-nowrap text-xs text-slate-500">
                  {formatDateTime(r.createdAt, TZ)}
                </span>
              ),
            },
          ]}
          rows={tickets}
          getRowKey={(r) => r.id}
          emptyMessage="No tickets yet."
        />
      </section>

      {/* New ticket form */}
      <section
        aria-labelledby="new-ticket-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2
          id="new-ticket-heading"
          className="mb-5 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500"
        >
          New ticket
        </h2>

        {successMsg && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-500/30 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label
              htmlFor="ticket-subject"
              className="block text-xs font-medium text-slate-700"
            >
              Subject
            </label>
            <input
              id="ticket-subject"
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              placeholder="Brief description of your issue"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-200 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="ticket-category"
              className="block text-xs font-medium text-slate-700"
            >
              Category
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "")}
              disabled={submitting}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors duration-200 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="ticket-description"
              className="block text-xs font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={5}
              placeholder="Please provide as much detail as possible"
              className="w-full resize-y rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-200 focus:border-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-800/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit ticket"}
          </button>
        </form>
      </section>
    </div>
  );
}
