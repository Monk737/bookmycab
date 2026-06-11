import type { ChatStatBlock, ChannelStat, RecentConversation } from "@/lib/dashboard/chat-analytics";
import { chatOutcomeLabel, channelLabel } from "@/lib/dashboard/chat-analytics";
import { ChannelIcon } from "@/components/dashboard/channel-icon";

/* Per-outcome flat fill. Colour always pairs with a label + count. */
const OUTCOME_FILL: Record<string, string> = {
  booked: "bg-brut-lime",
  quoted: "bg-brut-cyan",
  managed: "bg-brut-violet",
  abandoned: "bg-brut-orange",
  cancelled: "bg-brut-red",
  unknown: "bg-gray-300",
};

/** Ranked conversation-outcome breakdown as flat brutalist proportion bars. */
export function ChatOutcomeBars({ block }: { block: ChatStatBlock }) {
  if (block.outcomes.length === 0) {
    return <p className="text-sm text-gray-600">No conversations in this window yet.</p>;
  }
  const max = Math.max(1, ...block.outcomes.map((o) => o.count));
  return (
    <ul className="space-y-2.5">
      {block.outcomes.map((o) => (
        <li key={o.outcome} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.04em] text-ink">{o.label}</span>
          <span className="h-4 border-2 border-ink bg-paper">
            <span className={`block h-full ${OUTCOME_FILL[o.outcome] ?? "bg-gray-300"}`} style={{ width: `${Math.max(6, (o.count / max) * 100)}%` }} />
          </span>
          <span className="text-right font-mono text-sm font-bold tabular-nums text-ink">{o.count.toLocaleString("en-GB")}</span>
        </li>
      ))}
    </ul>
  );
}

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Healthy",
  warning: "Token expiring",
  disconnected: "Disconnected",
};
const HEALTH_FILL: Record<string, string> = {
  healthy: "bg-brut-lime",
  warning: "bg-brut-yellow",
  disconnected: "bg-brut-red",
};

/** Channel health + volume: one row per connected channel. */
export function ChannelHealthList({ channels }: { channels: ChannelStat[] }) {
  if (channels.length === 0) {
    return <p className="text-sm text-gray-600">No channels connected yet. Your build team wires WhatsApp, Messenger, Instagram, Telegram or the web widget into this plan.</p>;
  }
  const max = Math.max(1, ...channels.map((c) => c.conversations));
  return (
    <ul className="divide-y-2 divide-gray-100">
      {channels.map((c, i) => (
        <li key={`${c.type}-${i}`} className="py-3.5 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <ChannelIcon type={c.type} health={c.health} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">{channelLabel(c.type)}</p>
                {c.handle ? <p className="truncate font-mono text-xs text-gray-500">{c.handle}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 border-2 border-ink ${HEALTH_FILL[c.health]}`} aria-hidden="true" />
              <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-gray-600">{HEALTH_LABEL[c.health]}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="h-2.5 flex-1 border-2 border-ink bg-paper">
              <span className="block h-full bg-ink" style={{ width: `${(c.conversations / max) * 100}%` }} />
            </span>
            <span className="w-24 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-ink">
              {c.conversations.toLocaleString("en-GB")} chats
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

const REL_OUTCOME_FILL: Record<string, string> = OUTCOME_FILL;

function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Most recent conversations as a compact feed. */
export function RecentConversations({ items }: { items: RecentConversation[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-600">No conversations yet. They appear here the moment your bot starts a chat.</p>;
  }
  return (
    <ul className="divide-y-2 divide-gray-100">
      {items.map((c, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-3 w-3 shrink-0 border-2 border-ink ${REL_OUTCOME_FILL[c.outcome] ?? "bg-gray-300"}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{c.who}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-gray-500">
                {c.channel === "unknown" ? "—" : channelLabel(c.channel)} · {chatOutcomeLabel(c.outcome)}
              </p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">{timeAgo(c.startedAt)}</span>
        </li>
      ))}
    </ul>
  );
}
