import { requireStaff } from "@/lib/admin/guard";
import {
  listPendingChannelsForReview,
  listRecentlyReviewedChannels,
  type ReviewChannelRow,
} from "@/lib/channels/service";
import { StatCard, StatCardGrid } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { ChannelIcon } from "@/components/dashboard/channel-icon";
import type { ChannelType } from "@/lib/dashboard/types";
import { approveChannelAction, rejectChannelAction } from "./actions";

export const metadata = { title: "Channel review · Admin" };

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Web widget",
};

/** Compact relative time, e.g. "3h ago", "2d ago". */
function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function ChannelCell({ c }: { c: ReviewChannelRow }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-paper">
        <ChannelIcon type={c.type as ChannelType} health={c.status === "active" ? "healthy" : "disconnected"} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{CHANNEL_LABEL[c.type] ?? c.type}</p>
        <p className="truncate font-mono text-xs text-gray-600">{c.external_id ?? "no identifier"}</p>
      </div>
    </div>
  );
}

export default async function ChannelReviewPage() {
  await requireStaff();
  const [pending, reviewed] = await Promise.all([
    listPendingChannelsForReview(),
    listRecentlyReviewedChannels(8),
  ]);

  const byType = pending.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] ?? 0) + 1;
    return acc;
  }, {});
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
  const selfServe = pending.filter((c) => c.is_self_serve).length;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">Channel review</h1>
          <p className="mt-1 text-sm text-gray-600">
            Approve or reject tenant-requested channels before they go live on a webhook.
          </p>
        </div>
      </header>

      <StatCardGrid className="mt-6 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting review" value={pending.length} sub={pending.length ? "Action needed" : "All clear"} />
        <StatCard label="Self-serve" value={selfServe} sub="Requested by tenants" />
        <StatCard label="Most requested" value={topType ? (CHANNEL_LABEL[topType[0]] ?? topType[0]) : "·"} sub={topType ? `${topType[1]} pending` : "Nothing pending"} />
        <StatCard label="Recently actioned" value={reviewed.length} sub="Last 8 decisions" />
      </StatCardGrid>

      {/* Pending queue */}
      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Pending queue</h2>
        {pending.length === 0 ? (
          <div className="border-[3px] border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
            <p className="font-display text-base font-extrabold uppercase tracking-tight text-ink">Nothing to review</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-600">
              When a tenant requests a new channel from their dashboard, it lands here for approval.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden border-[3px] border-ink bg-paper shadow-brut">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-[3px] border-ink bg-ink">
                  {["Channel", "Tenant", "Automation", "Requested", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-paper">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => (
                  <tr key={c.id} className="border-b-2 border-gray-200 last:border-0 odd:bg-paper even:bg-gray-50">
                    <td className="px-4 py-3 align-middle"><ChannelCell c={c} /></td>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-bold text-ink">{c.tenant_name ?? "·"}</span>
                      {c.is_self_serve && (
                        <span className="ml-2 border-2 border-ink bg-brut-cyan px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-ink">self-serve</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle text-gray-700">{c.automation_name ?? "·"}</td>
                    <td className="px-4 py-3 align-middle font-mono text-xs tabular-nums text-gray-600">{ago(c.created_at)}</td>
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex justify-end gap-2">
                        <form action={approveChannelAction}>
                          <input type="hidden" name="channelId" value={c.id} />
                          <button type="submit" className="cursor-pointer border-2 border-ink bg-brut-lime px-3 py-1.5 text-xs font-bold uppercase tracking-[0.04em] text-ink shadow-brut-sm transition-colors hover:bg-brut-lime/80">
                            Approve
                          </button>
                        </form>
                        <form action={rejectChannelAction}>
                          <input type="hidden" name="channelId" value={c.id} />
                          <button type="submit" className="cursor-pointer border-2 border-ink bg-paper px-3 py-1.5 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10">
                            Reject
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recently reviewed */}
      {reviewed.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-gray-500">Recently actioned</h2>
          <ul className="divide-y-2 divide-gray-100 border-[3px] border-ink bg-paper shadow-brut">
            {reviewed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ChannelCell c={c} />
                  <span className="text-sm text-gray-600">{c.tenant_name ?? "·"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-500">{ago(c.created_at)}</span>
                  <StatusBadge status={c.provisioning_status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
