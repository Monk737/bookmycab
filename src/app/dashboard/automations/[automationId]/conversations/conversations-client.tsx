"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/dashboard/data-table";
import type { Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { SlideOver } from "@/components/dashboard/slide-over";
import { FilterBar } from "@/components/dashboard/filter-bar";
import type { FilterField } from "@/components/dashboard/filter-bar";
import {
  formatDateTime,
  formatDurationMs,
  truncateId,
} from "@/lib/dashboard/format";
import type { ConversationRow, ConversationDetail, MessageRow } from "@/lib/dashboard/types";

const FILTER_FIELDS: FilterField[] = [
  { key: "from", label: "From", type: "date" },
  { key: "to", label: "To", type: "date" },
  {
    key: "outcome",
    label: "Outcome",
    type: "select",
    options: [
      { value: "booked", label: "Booked" },
      { value: "quoted", label: "Quoted" },
      { value: "abandoned", label: "Abandoned" },
      { value: "managed", label: "Managed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  { key: "language", label: "Language", type: "search" },
  { key: "search", label: "Customer", type: "search" },
];

function MessageBubble({ message }: { message: MessageRow }) {
  // Outbound = the automation; inbound = the customer. Per DESIGN.md, the
  // customer speaks in Dispatch Amber, the automation in paper with a border.
  const isOutbound = message.direction === "outbound";
  const onAmber = !isOutbound;
  const payload = message.payload as Record<string, unknown> | null;

  // Muted / body text tones that stay legible on whichever bubble fill.
  const muted = onAmber ? "text-accent-ink/70" : "text-gray-500";
  const body = onAmber ? "text-accent-ink" : "text-gray-800";

  function renderContent() {
    if (message.messageType === "voice") {
      return (
        <div className="space-y-1">
          <div className={`flex items-center gap-1.5 ${muted}`}>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 flex-shrink-0"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span className="text-xs font-medium">Voice note</span>
          </div>
          {message.transcript && (
            <p className={`text-sm italic ${onAmber ? "text-accent-ink/90" : "text-gray-600"}`}>
              &ldquo;{message.transcript}&rdquo;
            </p>
          )}
          {message.intentExtracted != null && typeof message.intentExtracted === "object" && (
            <details className="mt-1">
              <summary
                className={
                  "cursor-pointer text-[11px] " +
                  (onAmber
                    ? "text-accent-ink/70 hover:text-accent-ink"
                    : "text-gray-500 hover:text-ink")
                }
              >
                Extracted details
              </summary>
              <pre
                className={`mt-1 overflow-x-auto  p-2 text-[11px] max-h-32 ${
                  onAmber ? "bg-accent-ink/10 text-accent-ink" : "bg-gray-100 text-gray-600"
                }`}
              >
                {JSON.stringify(message.intentExtracted as Record<string, unknown>, null, 2)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    if (message.messageType === "location") {
      const lat = payload?.lat ?? payload?.latitude;
      const lng = payload?.lng ?? payload?.longitude ?? payload?.lon;
      return (
        <div className={`flex items-center gap-1.5 text-sm ${body}`}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 flex-shrink-0"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>
            Location
            {lat !== undefined && lng !== undefined
              ? `: ${String(lat)}, ${String(lng)}`
              : ""}
          </span>
        </div>
      );
    }

    const text =
      (payload?.text as string) ??
      (payload?.body as string) ??
      (typeof payload === "string" ? payload : null) ??
      (message.transcript ?? "");

    return <p className={`whitespace-pre-wrap text-sm ${body}`}>{text || "(no text)"}</p>;
  }

  const intentLabel =
    message.intentExtracted && typeof message.intentExtracted === "object"
      ? (message.intentExtracted as Record<string, unknown>).intent as string | undefined
      : undefined;

  return (
    <div className={`flex flex-col gap-0.5 ${isOutbound ? "items-end" : "items-start"}`}>
      {intentLabel && (
        <span className="self-start rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
          Intent: {intentLabel}
        </span>
      )}
      <div
        className={`max-w-[80%] px-3.5 py-2.5 ${
          onAmber
            ? "-md bg-accent text-accent-ink"
            : "-md border border-gray-200 bg-paper text-ink"
        }`}
      >
        {renderContent()}
      </div>
      <time
        className="text-[10px] text-gray-400"
        dateTime={message.ts}
        title={message.ts}
      >
        {formatDateTime(message.ts, "Europe/London")}
      </time>
    </div>
  );
}

export function ConversationsClient({
  orgId,
  automationId,
  initialRows,
  total,
  filterValues,
}: {
  orgId: string;
  automationId: string;
  initialRows: ConversationRow[];
  total: number;
  filterValues: Record<string, string>;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Pagination
  const page = Number(filterValues.page ?? "1") || 1;
  const limit = Number(filterValues.limit ?? "50") || 50;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function goToPage(p: number) {
    const params = new URLSearchParams(filterValues);
    params.set("page", String(p));
    router.replace(`?${params.toString()}`);
  }

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/automations/${automationId}/conversations/${id}`,
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = (await res.json()) as { conversation: ConversationDetail };
      setDetail(json.conversation);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load transcript");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  }

  function durationLabel(row: ConversationRow): string {
    if (!row.startedAt || !row.endedAt) return "·";
    const ms = new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime();
    if (Number.isNaN(ms) || ms < 0) return "·";
    return formatDurationMs(ms);
  }

  const columns: Column<ConversationRow>[] = [
    {
      key: "id",
      header: "Conversation ID",
      render: (row) => (
        <span className="font-mono text-[11px] text-gray-600">{truncateId(row.id)}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <span className="font-medium text-ink">
          {row.customerName ?? row.customerHandle}
        </span>
      ),
    },
    {
      key: "channel",
      header: "Channel",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.channelId ?? "·"}</span>
      ),
    },
    {
      key: "started",
      header: "Started",
      render: (row) => (
        <span className="whitespace-nowrap text-sm">
          {formatDateTime(row.startedAt, "Europe/London")}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      render: (row) => (
        <span className="tabular-nums text-sm">{durationLabel(row)}</span>
      ),
    },
    {
      key: "outcome",
      header: "Outcome",
      render: (row) =>
        row.outcome ? (
          <StatusBadge status={row.outcome} />
        ) : (
          <StatusBadge status="unknown" />
        ),
    },
    {
      key: "language",
      header: "Language",
      render: (row) => (
        <span className="text-sm text-gray-600">{row.language ?? "·"}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <button
          type="button"
          onClick={() => openDetail(row.id)}
          className="cursor-pointer  text-sm font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          View transcript
        </button>
      ),
    },
  ];

  const selectedRow = initialRows.find((r) => r.id === selectedId);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
      {/* Header */}
      <h1 className="text-xl font-bold text-ink">Conversations</h1>

      {/* Filters */}
      <FilterBar fields={FILTER_FIELDS} values={filterValues} />

      {/* Record count */}
      <p className="text-sm text-gray-500">
        {total === 0
          ? "No conversations found."
          : `Showing page ${page} of ${totalPages} (${total} total)`}
      </p>

      {/* Table */}
      <DataTable<ConversationRow>
        columns={columns}
        rows={initialRows}
        getRowKey={(row) => row.id}
        emptyMessage="No conversations match the current filters."
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="border-[3px] border-ink bg-paper px-3 py-2 text-sm text-gray-700 shadow-brut-sm transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="border-[3px] border-ink bg-paper px-3 py-2 text-sm text-gray-700 shadow-brut-sm transition-colors duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink cursor-pointer"
          >
            Next
          </button>
        </div>
      )}

      {/* Transcript SlideOver */}
      <SlideOver
        open={selectedId !== null}
        onClose={closeDetail}
        title={`Transcript ${truncateId(selectedId)}`}
      >
        {detailLoading && (
          <p className="text-sm text-gray-500 py-6 text-center">Loading transcript…</p>
        )}
        {detailError && (
          <p className="text-sm text-brut-red-deep py-4">{detailError}</p>
        )}
        {detail && !detailLoading && (
          <div className="space-y-4">
            {/* Conversation metadata */}
            <div className="flex flex-wrap gap-2 items-center">
              {detail.outcome && <StatusBadge status={detail.outcome} />}
              {detail.language && (
                <span className=" border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                  {detail.language}
                </span>
              )}
              <span className="text-xs text-gray-500">
                {formatDateTime(detail.startedAt, "Europe/London")}
              </span>
            </div>

            {/* Customer info */}
            <div className="text-sm">
              <span className="text-gray-500">Customer: </span>
              <span className="font-medium text-ink">
                {detail.customerName ?? detail.customerHandle}
              </span>
            </div>

            {/* Abandonment reason */}
            {detail.abandonmentReason && (
              <div className=" bg-brut-yellow/30 border border-ink px-3 py-2 text-sm text-ink">
                <span className="font-medium">Abandoned: </span>
                {detail.abandonmentReason}
              </div>
            )}

            {/* Linked booking */}
            {detail.bookingId && (
              <div className="border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                  Linked booking
                </p>
                <a
                  href={`/dashboard/automations/${automationId}/bookings?id=${detail.bookingId}`}
                  className=" text-sm font-medium text-ink underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  View booking {truncateId(detail.bookingId)} &rarr;
                </a>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Transcript ({detail.messages.length} messages)
              </h4>
              {detail.messages.length === 0 && (
                <p className="text-sm text-gray-400">No messages recorded.</p>
              )}
              {detail.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          </div>
        )}

        {/* Row summary when no detail loaded yet */}
        {!detail && !detailLoading && !detailError && selectedRow && (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              Customer:{" "}
              <span className="font-medium text-ink">
                {selectedRow.customerName ?? selectedRow.customerHandle}
              </span>
            </p>
            <p className="text-gray-600">
              Started:{" "}
              <span className="font-medium text-ink">
                {formatDateTime(selectedRow.startedAt, "Europe/London")}
              </span>
            </p>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
