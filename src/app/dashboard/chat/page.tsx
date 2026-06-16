import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChatAnalytics } from "@/lib/dashboard/chat-analytics";
import { getChatConversations, getChatBookings } from "@/lib/dashboard/chat-log";
import { tierLabel } from "@/lib/dashboard/product-overview";
import { StatTile, StatGrid, Panel, EmptyState } from "@/components/dashboard/ui";
import { ConversationsTrend } from "@/components/dashboard/chat/conversations-trend";
import { ChatOutcomeBars, ChannelHealthList } from "@/components/dashboard/chat/chat-blocks";
import { ConversationsLog, BookingsLog } from "@/components/dashboard/chat/chat-logs";

export const metadata = { title: "Chat · BookMyCab" };

const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="square" className="h-6 w-6">
    <path d="M4 5h16v11H7l-3 3z" />
  </svg>
);

export default async function ChatPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const c = await getChatAnalytics(claims.tenant_id, 30);

  if (!c.hasChat) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="mb-6 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink">Chat</h1>
        <EmptyState
          icon={ChatIcon}
          title="No chat bot yet"
          body="This account runs AI Voice only. Add a Chat product to take bookings on WhatsApp. Your build team sets it up."
          action={
            <Link href="/dashboard/support" className="brut-press inline-flex h-11 items-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut">
              Ask about Chat
            </Link>
          }
        />
      </div>
    );
  }

  const [conversations, bookings] = await Promise.all([
    getChatConversations(claims.tenant_id, 90),
    getChatBookings(claims.tenant_id, 90),
  ]);

  const connected = c.channels.filter((ch) => ch.health !== "disconnected").length;
  const hasConvos = c.aggregate.totalConversations > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Chat analytics</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Chat</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium text-gray-600">Last {c.rangeDays} days · {c.channels.length} channel{c.channels.length === 1 ? "" : "s"}</p>
          <Link
            href="/dashboard/chat/briefing"
            className="brut-press brut-focus inline-flex h-9 items-center border-[3px] border-ink bg-paper px-3.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink shadow-brut-sm"
          >
            Weekly Briefing
          </Link>
          <Link
            href="/dashboard/chat/intelligence"
            className="brut-press brut-focus inline-flex h-9 items-center border-[3px] border-ink bg-brut-yellow px-3.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink shadow-brut"
          >
            Chat Intelligence &rarr;
          </Link>
        </div>
      </header>

      {/* Headline figures — all sourced from the WhatsApp Chat + Voice Note workflow. */}
      <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Conversations" value={c.aggregate.totalConversations.toLocaleString("en-GB")} sub={`last ${c.rangeDays} days`} />
        <StatTile label="Booked rate" value={`${c.aggregate.bookedPct}%`} sub={`${c.aggregate.booked.toLocaleString("en-GB")} booked`} />
        <StatTile label="Bookings" value={c.aggregate.booked.toLocaleString("en-GB")} sub="from chat" />
        <StatTile label="Voice notes" value={c.voiceNotes.toLocaleString("en-GB")} sub="chats via audio" />
        <StatTile label="Channels live" value={connected} sub={`of ${c.channels.length} connected`} />
        <StatTile label="Plan" value={tierLabel(c.tier)} sub="WhatsApp + Voice Note" />
      </StatGrid>

      {/* Volume + outcomes. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Conversation volume" className="lg:col-span-2">
          {hasConvos ? (
            <ConversationsTrend data={c.trend} />
          ) : (
            <div className="flex h-56 flex-col items-center justify-center border-[3px] border-dashed border-gray-300 bg-gray-50 text-center">
              <p className="font-display text-base font-extrabold uppercase tracking-tight text-ink">No conversations yet</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm text-gray-600">When your bot starts a chat, daily volume and booking outcomes land here.</p>
            </div>
          )}
        </Panel>
        <Panel title="Outcomes">
          <ChatOutcomeBars block={c.aggregate} />
        </Panel>
      </div>

      {/* Channels. */}
      <div className="mt-5">
        <Panel title="Channels">
          <ChannelHealthList channels={c.channels} />
        </Panel>
      </div>

      {/* Day-filtered logs: conversations (left) + bookings (right). Distinct
          surfaces — interaction-centric vs dispatch-centric — each searchable,
          date-filtered and scrollable, with click-through detail. */}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <ConversationsLog items={conversations} />
        <BookingsLog items={bookings} />
      </div>
    </div>
  );
}
