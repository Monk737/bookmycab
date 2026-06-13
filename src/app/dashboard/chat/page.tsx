import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChatAnalytics, channelLabel } from "@/lib/dashboard/chat-analytics";
import { tierLabel } from "@/lib/dashboard/product-overview";
import { StatTile, StatGrid, Panel, EmptyState } from "@/components/dashboard/ui";
import { ConversationsTrend } from "@/components/dashboard/chat/conversations-trend";
import { ChatOutcomeBars, ChannelHealthList, RecentConversations } from "@/components/dashboard/chat/chat-blocks";

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
          body="This account runs AI Voice only. Add a Chat product to take bookings on WhatsApp, Messenger, Instagram, Telegram and your website widget. Your build team sets it up."
          action={
            <Link href="/dashboard/support" className="brut-press inline-flex h-11 items-center border-[3px] border-ink bg-brut-yellow px-5 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut">
              Ask about Chat
            </Link>
          }
        />
      </div>
    );
  }

  const connected = c.channels.filter((ch) => ch.health !== "disconnected").length;
  const busiest = c.channels.find((ch) => ch.conversations > 0);
  const hasConvos = c.aggregate.totalConversations > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Chat analytics</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">Chat</h1>
        </div>
        <p className="text-xs font-medium text-gray-600">Last {c.rangeDays} days · {c.channels.length} channel{c.channels.length === 1 ? "" : "s"}</p>
      </header>

      {/* Headline figures. */}
      <StatGrid cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Conversations" value={c.aggregate.totalConversations.toLocaleString("en-GB")} sub="last 30 days" />
        <StatTile label="Booked rate" value={`${c.aggregate.bookedPct}%`} sub={`${c.aggregate.booked.toLocaleString("en-GB")} booked`} />
        <StatTile label="Bookings" value={c.aggregate.booked.toLocaleString("en-GB")} sub="from chat" />
        <StatTile label="Channels live" value={connected} sub={`of ${c.channels.length} connected`} />
        <StatTile label="Busiest" value={busiest ? channelLabel(busiest.type) : "—"} sub={busiest ? `${busiest.conversations.toLocaleString("en-GB")} chats` : "No traffic yet"} />
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

      {/* Channel health + recent activity. */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Channels">
          <ChannelHealthList channels={c.channels} />
        </Panel>
        <Panel title="Recent conversations">
          <RecentConversations items={c.recent} />
        </Panel>
      </div>
    </div>
  );
}
