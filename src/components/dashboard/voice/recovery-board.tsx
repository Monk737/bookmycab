"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRecoveryStatus } from "@/app/dashboard/voice/intelligence/actions";
import type { RecoveryItem } from "@/lib/voice/intelligence";

function fmtMoney(n: number) {
  return `£${n.toLocaleString("en-GB")}`;
}
function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const OUTCOME_BADGE: Record<string, string> = { quoted: "bg-brut-cyan", abandoned: "bg-brut-orange" };

/**
 * The money panel: lost bookings (quoted or abandoned, never booked) the operator
 * can call back, with the quoted fare and a one-tap Contacted / Recovered / Dismiss.
 */
export function RecoveryBoard({
  items,
  recoverable,
  recoveredValue,
  recoveredCount,
}: {
  items: RecoveryItem[];
  recoverable: number;
  recoveredValue: number;
  recoveredCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function act(recoveryId: string, status: string) {
    setBusyId(recoveryId);
    start(async () => {
      await updateRecoveryStatus({ recoveryId, status });
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-col border-b-[3px] border-ink sm:flex-row sm:items-stretch sm:justify-between">
        <div className="flex flex-col justify-center px-5 py-4">
          <h2 className="font-display text-lg font-extrabold uppercase tracking-tight text-ink">Lost-revenue recovery</h2>
          <p className="text-sm text-gray-600">Callers who got a quote or dropped off without booking.</p>
        </div>
        <div className="flex border-t-[3px] border-ink sm:border-t-0">
          <div className="flex flex-1 flex-col justify-center border-l-[3px] border-ink bg-brut-yellow px-5 py-4 text-center sm:flex-none">
            <p className="font-mono text-3xl font-extrabold tabular-nums text-ink sm:text-4xl">{fmtMoney(recoverable)}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink/70">
              Recoverable · {items.length} call{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-center border-l-[3px] border-ink bg-brut-lime px-5 py-4 text-center sm:flex-none">
            <p className="font-mono text-2xl font-extrabold tabular-nums text-ink sm:text-3xl">{fmtMoney(recoveredValue)}</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink/70">Recovered · {recoveredCount}</p>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-600">
          No lost bookings to chase. Every quote either booked or is already actioned.
        </p>
      ) : (
        <ul className="divide-y-2 divide-gray-100">
          {items.map((it) => (
            <li key={it.recoveryId} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {it.quotedFare != null ? (
                    <span className="font-mono text-base font-extrabold tabular-nums text-ink">{fmtMoney(it.quotedFare)}</span>
                  ) : (
                    <span className="text-sm text-gray-400">no quote</span>
                  )}
                  <span className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${OUTCOME_BADGE[it.outcome] ?? "bg-gray-100"}`}>
                    {it.outcome}
                  </span>
                  {it.status === "contacted" ? (
                    <span className="border-2 border-ink bg-brut-violet px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">contacted</span>
                  ) : null}
                  {it.caller ? (
                    <span className="font-mono text-xs text-gray-600">{it.caller}</span>
                  ) : (
                    <span className="text-xs text-gray-400">number withheld</span>
                  )}
                  <span className="font-mono text-xs tabular-nums text-gray-500">{fmtWhen(it.startedAt)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-gray-700">
                  {it.pickup ?? "—"} <span className="text-gray-400">&rarr;</span> {it.destination ?? "—"}
                  {it.vehicleType ? <span className="text-gray-500"> · {it.vehicleType}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {it.status !== "contacted" ? (
                  <button
                    type="button"
                    disabled={pending && busyId === it.recoveryId}
                    onClick={() => act(it.recoveryId, "contacted")}
                    className="brut-press brut-focus border-2 border-ink bg-paper px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink disabled:opacity-50"
                  >
                    Contacted
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending && busyId === it.recoveryId}
                  onClick={() => act(it.recoveryId, "recovered")}
                  className="brut-press brut-focus border-2 border-ink bg-brut-lime px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink disabled:opacity-50"
                >
                  Recovered
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  disabled={pending && busyId === it.recoveryId}
                  onClick={() => act(it.recoveryId, "dismissed")}
                  className="brut-press brut-focus border-2 border-ink bg-paper px-2.5 py-1.5 text-[11px] font-bold text-gray-500 disabled:opacity-50"
                >
                  &times;
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
