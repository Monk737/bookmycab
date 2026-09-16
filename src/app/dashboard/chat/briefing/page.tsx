import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getLatestChatBriefing, getRecentChatBriefings } from "@/lib/chat/briefing";
import { ChatWeeklyBriefing } from "@/components/dashboard/chat/weekly-briefing";
import { ChatBriefingArchive } from "@/components/dashboard/chat/briefing-archive";

export const metadata = { title: "Weekly AI Chat Briefing · BookMyCab" };

export default async function ChatBriefingPage() {
  const claims = await requireUser();
  if (!claims.tenant_id) {
    return <div className="p-8 text-sm text-gray-700">No organisation linked to your account.</div>;
  }

  const [latest, history] = await Promise.all([
    getLatestChatBriefing(claims.tenant_id),
    getRecentChatBriefings(claims.tenant_id, 9),
  ]);
  const earlier = history.filter((b) => b.periodStart !== latest?.periodStart);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <Link href="/dashboard/chat" className="brut-focus text-[11px] font-bold uppercase tracking-[0.12em] text-gray-500 hover:text-ink">
          &larr; Chat
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-[-0.02em] text-ink sm:text-4xl">
            Weekly AI Chat Briefing
          </h1>
          <span className="border-2 border-ink bg-brut-yellow px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink shadow-brut-sm">
            Every Monday morning
          </span>
        </div>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-gray-600">
          A plain-language read of your WhatsApp chatbot week, what changed, what cost you bookings, and one fix to try.
          Written fresh every Monday over the previous seven days of chats and bookings.
        </p>
      </header>

      <ChatWeeklyBriefing briefing={latest} />

      {earlier.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-4 font-display text-xl font-extrabold uppercase tracking-tight text-ink">Earlier weeks</h2>
          <ChatBriefingArchive briefings={earlier} />
        </section>
      ) : null}
    </div>
  );
}
