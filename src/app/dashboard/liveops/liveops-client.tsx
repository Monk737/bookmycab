"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Conversation { id: string; customer_handle: string; customer_name: string | null; takeover_status: string; started_at: string }
interface Msg { id: string; direction: string; source: string; payload: unknown; transcript: string | null; ts: string }

export function LiveopsClient(props: { orgId: string; conversations: Conversation[]; isDemo: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = (id: string) => `/api/orgs/${props.orgId}/liveops/${id}`;

  async function openConv(c: Conversation) {
    setSelected(c); setErr(null);
    const res = await fetch(`${base(c.id)}/messages`);
    const b = await res.json().catch(() => ({ messages: [] }));
    setThread(b.messages ?? []);
  }
  async function act(url: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      else { router.refresh(); if (selected) await openConv(selected); }
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  function textOf(m: Msg): string {
    if (m.transcript) return m.transcript;
    const p = m.payload as { text?: string } | null;
    return p?.text ?? "[non-text message]";
  }

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <div className="border border-gray-200">
        <ul className="divide-y divide-gray-100 text-sm">
          {props.conversations.length === 0 && <li className="p-3 text-gray-400">No active conversations.</li>}
          {props.conversations.map((c) => (
            <li key={c.id}>
              <button onClick={() => openConv(c)} className={`flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 ${selected?.id === c.id ? "bg-gray-50" : ""}`}>
                <span><span className="font-medium text-gray-800">{c.customer_name ?? c.customer_handle}</span><br /><span className="text-xs text-gray-400">{c.customer_handle}</span></span>
                <span className={c.takeover_status === "human" ? " bg-brut-yellow/40 px-1.5 py-0.5 text-[11px] text-ink" : " bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500"}>{c.takeover_status}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-gray-200 p-4">
        {!selected && <p className="text-sm text-gray-400">Select a conversation.</p>}
        {selected && (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-gray-800">{selected.customer_name ?? selected.customer_handle}</span>
              {!props.isDemo && (
                selected.takeover_status === "human"
                  ? <button disabled={busy} onClick={() => act(`${base(selected.id)}/claim?action=release`)} className=" border-[3px] border-ink px-2 py-1 text-xs text-gray-700">Hand back to bot</button>
                  : <button disabled={busy} onClick={() => act(`${base(selected.id)}/claim`)} className=" border-2 border-ink bg-brut-yellow shadow-brut-sm px-2 py-1 text-xs font-medium text-ink">Take over</button>
              )}
            </div>
            <div className="mb-3 max-h-80 flex-1 space-y-1 overflow-y-auto  bg-gray-50 p-2 text-sm">
              {thread.map((m) => (
                <div key={m.id} className={m.direction === "inbound" ? "text-gray-800" : m.source === "human" ? "font-bold text-ink" : "text-ink"}>
                  <span className="text-[11px] uppercase text-gray-400">{m.direction === "inbound" ? "customer" : m.source}</span> {textOf(m)}
                </div>
              ))}
              {thread.length === 0 && <p className="text-gray-400">No messages.</p>}
            </div>
            {!props.isDemo && selected.takeover_status === "human" && (
              <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { void act(`${base(selected.id)}/messages`, { text }); setText(""); } }} className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Reply as dispatcher…" className="flex-1  border-[3px] border-ink px-2 py-1 text-sm" />
                <button disabled={busy} type="submit" className=" border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-50">Send</button>
              </form>
            )}
            {err && <p className="mt-2 text-sm text-brut-red-deep" role="alert">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
