import Link from "next/link";
import { StatusPill } from "@/components/dashboard/ui";
import { ChannelIcon } from "@/components/dashboard/channel-icon";
import type { AutomationCardData } from "@/lib/dashboard/automations";
import type { ChannelType } from "@/lib/dashboard/product-overview";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Web widget",
};

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-paper px-3 py-3">
      <p className="font-mono text-xl font-extrabold tabular-nums text-ink">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.07em] text-gray-500">{label}</p>
    </div>
  );
}

/**
 * One deployed automation (Chat or AI Voice), with its identity and the work it
 * performed over the window. Used on the Overview — a single automation renders
 * full-width, multiple sit in a grid.
 */
export function AutomationCard({ a, windowDays }: { a: AutomationCardData; windowDays: number }) {
  const href = a.isVoice ? "/dashboard/voice" : "/dashboard/chat";
  return (
    <section className="flex flex-col border-[3px] border-ink bg-paper shadow-brut">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b-[3px] border-ink px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border-2 border-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${a.isVoice ? "bg-brut-violet" : "bg-brut-cyan"}`}>
              {a.isVoice ? "AI Voice" : "Chat"}
            </span>
            <StatusPill status={a.status} />
          </div>
          <h3 className="mt-2 truncate font-display text-lg font-extrabold uppercase tracking-tight text-ink">{a.name}</h3>
          {a.phone ? <p className="font-mono text-xs text-gray-500">{a.phone}</p> : null}
        </div>
        <Link
          href={href}
          className="brut-press brut-focus shrink-0 border-2 border-ink bg-brut-yellow px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink"
        >
          Open
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {!a.isVoice && a.channels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {a.channels.map((c, i) => (
              <span key={`${c.type}-${i}`} className="inline-flex items-center gap-1.5 border-2 border-ink bg-gray-50 px-2 py-1 text-[11px] font-bold text-ink">
                <ChannelIcon type={c.type as ChannelType} health={c.health} />
                {CHANNEL_LABEL[c.type] ?? c.type}
              </span>
            ))}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
            Work performed · last {windowDays} days
          </p>
          <div className="grid grid-cols-2 gap-[3px] border-[3px] border-ink bg-ink sm:grid-cols-4">
            {a.isVoice && a.voice ? (
              <>
                <Stat value={a.voice.calls.toLocaleString("en-GB")} label="Calls" />
                <Stat value={a.voice.booked.toLocaleString("en-GB")} label="Booked" />
                <Stat value={`${a.voice.bookedPct}%`} label="Booked rate" />
                <Stat value={a.voice.calls > 0 ? fmtDur(a.voice.avgDurationS) : "—"} label="Avg length" />
              </>
            ) : a.chat ? (
              <>
                <Stat value={a.chat.conversations.toLocaleString("en-GB")} label="Conversations" />
                <Stat value={a.chat.bookings.toLocaleString("en-GB")} label="Bookings" />
                <Stat value={`${a.chat.bookedPct}%`} label="Booked rate" />
                <Stat value={a.channels.length} label="Channels" />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
