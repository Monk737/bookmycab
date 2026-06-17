"use client";

import { useId, useTransition } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { BUILD_STAGES, EDITABLE_BUILD_STAGES } from "./stages";
import { setBuildStage, goLive } from "./actions";

export type BuildCard = {
  id: string;
  tenantName: string;
  name: string;
  type: string;
  status: string;
  buildStage: string;
  engineerEmail: string | null;
  targetGoLive: string | null;
  buildNotes: string | null;
  invoicePaid: boolean;
};

function formatDate(value: string | null): string {
  if (!value) return "·";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "·";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Five-column Kanban for the build pipeline. Stage moves use a per-card
 * `<select>` (deliberately over drag-and-drop: keyboard-accessible, testable,
 * and works without pointer gestures). UAT cards get a "Go Live" button that
 * promotes both build_stage and runtime status. All mutations go through the
 * server actions, which re-check staff and write audit entries.
 */
export function BuildQueueBoard({ cards }: { cards: BuildCard[] }) {
  const byStage = new Map<string, BuildCard[]>();
  for (const stage of BUILD_STAGES) byStage.set(stage, []);
  for (const card of cards) {
    // Unknown stage values (shouldn't happen given the DB CHECK) fall into the
    // first column rather than being dropped.
    (byStage.get(card.buildStage) ?? byStage.get(BUILD_STAGES[0])!).push(card);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {BUILD_STAGES.map((stage) => {
        const stageCards = byStage.get(stage) ?? [];
        return (
          <section
            key={stage}
            aria-label={`${stage} column`}
            className="flex flex-col border-[3px] border-ink bg-gray-50"
          >
            <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-gray-600">
                {stage}
              </span>
              <span className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-600">
                {stageCards.length}
              </span>
            </header>
            <div className="flex flex-col gap-2 p-2">
              {stageCards.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-gray-400">
                  Empty
                </p>
              ) : (
                stageCards.map((card) => (
                  <Card key={card.id} card={card} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({ card }: { card: BuildCard }) {
  const selectId = useId();
  const [pending, startTransition] = useTransition();

  function handleStageChange(next: string) {
    if (next === card.buildStage) return;
    startTransition(async () => {
      await setBuildStage(card.id, next);
    });
  }

  function handleGoLive() {
    startTransition(async () => {
      await goLive(card.id);
    });
  }

  return (
    <article
      className={`border-[3px] border-ink bg-paper p-3 shadow-brut-sm transition-opacity ${
        pending ? "opacity-60" : ""
      }`}
    >
      <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {card.tenantName}
      </p>
      <p className="mt-0.5 text-sm font-medium text-ink">{card.name}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {card.type}
        </span>
        <StatusBadge status={card.status} />
      </div>

      <dl className="mt-2.5 space-y-1 text-xs text-gray-600">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-gray-400">Engineer</dt>
          <dd className="truncate text-right text-gray-700">
            {card.engineerEmail ?? "Unassigned"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-gray-400">Go-live</dt>
          <dd className="text-right tabular-nums text-gray-700">
            {formatDate(card.targetGoLive)}
          </dd>
        </div>
      </dl>

      {card.buildNotes && (
        <p className="mt-2 line-clamp-2 text-xs text-gray-500">{card.buildNotes}</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {card.buildStage === "Live" ? (
          // A card already AT Live shows its stage as a static label. Staff never
          // move OFF Live via the select, and never back ONTO it except through
          // the dedicated Go Live button (which keeps build_stage ↔ status atomic).
          <span className="border border-ink bg-brut-lime/25 px-2 py-1.5 text-center font-mono text-[11px] font-medium uppercase tracking-wider text-ink">
            Live
          </span>
        ) : (
          <>
            <label htmlFor={selectId} className="sr-only">
              Build stage for {card.name}
            </label>
            <select
              id={selectId}
              value={card.buildStage}
              disabled={pending}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full cursor-pointer border-[3px] border-ink bg-paper px-2 py-1.5 text-xs text-ink outline-none transition-colors hover:border-gray-400 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {EDITABLE_BUILD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </>
        )}

        {card.buildStage === "UAT" && (
          <>
            {!card.invoicePaid && (
              <p className="border-2 border-ink bg-brut-red/15 px-2 py-1.5 text-center font-mono text-[10px] font-medium uppercase tracking-wider text-brut-red-deep">
                ⚠ Invoice unpaid
              </p>
            )}
            <button
              type="button"
              onClick={handleGoLive}
              disabled={pending}
              className="cursor-pointer bg-brut-lime px-2 py-1.5 text-xs font-medium text-white outline-none transition-colors hover:bg-brut-lime focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Working…" : card.invoicePaid ? "Go Live" : "Go Live anyway"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
