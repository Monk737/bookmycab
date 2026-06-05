"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Account { id: string; name: string; billing_email: string | null; credit_terms: number; markup_pct: number; active: boolean }
interface Invoice { id: string; account_customer_id: string; period_start: string; period_end: string; subtotal: number; markup: number; total: number; currency: string; status: string }

export function InvoicingClient(props: { orgId: string; accounts: Account[]; invoices: Invoice[]; isDemo: boolean }) {
  const router = useRouter();
  const base = `/api/orgs/${props.orgId}/invoicing`;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nameById = new Map(props.accounts.map((a) => [a.id, a.name]));

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) setErr(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      else router.refresh();
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Accounts</h2>
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {props.accounts.length === 0 && <li className="py-2 text-slate-400">No accounts yet.</li>}
          {props.accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-slate-800">{a.name} <span className="text-xs text-slate-400">· {a.markup_pct}% markup · {a.credit_terms}d</span></span>
              {!props.isDemo && (
                <GenerateForm onSubmit={(ps, pe) => call(`${base}/generate`, "POST", { accountId: a.id, periodStart: ps, periodEnd: pe })} busy={busy} />
              )}
            </li>
          ))}
        </ul>
        {!props.isDemo && (
          <form
            onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); void call(`${base}/accounts`, "POST", { name: f.get("name"), billingEmail: f.get("billingEmail"), markupPct: Number(f.get("markupPct")) }); e.currentTarget.reset(); }}
            className="flex flex-wrap gap-2"
          >
            <input name="name" required placeholder="Account name" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
            <input name="billingEmail" type="email" placeholder="billing@…" className="rounded border border-slate-300 px-2 py-1 text-sm" />
            <input name="markupPct" type="number" step="0.1" defaultValue="0" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
            <button disabled={busy} type="submit" className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Add account</button>
          </form>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Invoices</h2>
        {err && <p className="mb-2 text-sm text-red-600" role="alert">{err}</p>}
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr>{["Account", "Period", "Total", "Status", ""].map((h) => <th key={h} className="px-2 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {props.invoices.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-400">No invoices yet.</td></tr>}
            {props.invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="px-2 py-2 text-slate-800">{nameById.get(inv.account_customer_id) ?? "—"}</td>
                <td className="px-2 py-2 text-slate-500">{inv.period_start} → {inv.period_end}</td>
                <td className="px-2 py-2 text-slate-700">£{Number(inv.total).toFixed(2)}</td>
                <td className="px-2 py-2"><span className={inv.status === "paid" ? "text-emerald-600" : inv.status === "issued" ? "text-blue-700" : inv.status === "void" ? "text-slate-400" : "text-amber-600"}>{inv.status}</span></td>
                <td className="px-2 py-2 text-right">
                  {!props.isDemo && inv.status !== "paid" && inv.status !== "void" && (
                    <span className="flex justify-end gap-1">
                      {inv.status === "draft" && <button disabled={busy} onClick={() => call(`${base}/${inv.id}`, "PATCH", { status: "issued" })} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Issue</button>}
                      <button disabled={busy} onClick={() => call(`${base}/${inv.id}`, "PATCH", { status: "paid" })} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Mark paid</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function GenerateForm({ onSubmit, busy }: { onSubmit: (periodStart: string, periodEnd: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button onClick={() => setOpen(true)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Invoice…</button>;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSubmit(String(f.get("ps")), String(f.get("pe"))); setOpen(false); }} className="flex items-center gap-1">
      <input name="ps" type="date" required className="rounded border border-slate-300 px-1 py-0.5 text-xs" />
      <input name="pe" type="date" required className="rounded border border-slate-300 px-1 py-0.5 text-xs" />
      <button disabled={busy} type="submit" className="rounded bg-blue-800 px-2 py-1 text-xs font-medium text-white">Go</button>
    </form>
  );
}
