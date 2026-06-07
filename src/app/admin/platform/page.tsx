import { requireStaff } from "@/lib/admin/guard";
import { listCommission, listApps, listSenders } from "@/lib/admin/platform-config";
import { setCommissionAction, createAppAction, toggleAppAction, createSenderAction, toggleSenderAction } from "./actions";

export const metadata = { title: "Platform config, Admin" };

export default async function PlatformPage() {
  await requireStaff();
  const [commission, apps, senders] = await Promise.all([listCommission(), listApps(), listSenders()]);
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Platform config</h1>
        <p className="text-sm text-gray-500">Commission, channel apps, and notification senders (FlowMo-owned).</p>
      </div>

      <section className="border-[3px] border-ink p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">Commission rates</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50"><tr>{["Tenant", "Current %", "Set"].map((h) => <th key={h} className="px-3 py-1.5 text-left font-bold text-gray-700">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100">
            {commission.map((c) => (
              <tr key={c.tenantId}>
                <td className="px-3 py-1.5 text-gray-800">{c.name}</td>
                <td className="px-3 py-1.5 text-gray-600">{c.pct === null ? "·" : `${c.pct}%`}</td>
                <td className="px-3 py-1.5">
                  <form action={setCommissionAction} className="flex items-center gap-1">
                    <input type="hidden" name="tenantId" value={c.tenantId} />
                    <input name="pct" type="number" step="0.1" defaultValue={c.pct ?? 0} className="w-16 rounded border-[3px] border-ink px-1 py-0.5 text-xs" />
                    <button type="submit" className="rounded border-2 border-ink bg-brut-yellow shadow-brut-sm px-2 py-1 text-xs font-medium text-ink">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border-[3px] border-ink p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">Channel apps (WhatsApp BSP / Meta)</h2>
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {apps.length === 0 && <li className="py-2 text-gray-400">No apps configured.</li>}
          {apps.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span className="text-gray-800">{a.provider} <span className="text-xs text-gray-400">{a.identifier}</span></span>
              <form action={toggleAppAction}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={a.status} /><button type="submit" className={a.status === "active" ? "rounded bg-brut-lime/40 px-2 py-1 text-xs text-ink" : "rounded bg-gray-100 px-2 py-1 text-xs text-gray-500"}>{a.status}</button></form>
            </li>
          ))}
        </ul>
        <form action={createAppAction} className="flex gap-2">
          <input name="provider" required placeholder="provider (meta/360dialog)" className="rounded border-[3px] border-ink px-2 py-1 text-sm" />
          <input name="identifier" required placeholder="app/account id" className="flex-1 rounded border-[3px] border-ink px-2 py-1 text-sm" />
          <button type="submit" className="rounded border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink">Add app</button>
        </form>
      </section>

      <section className="border-[3px] border-ink p-4">
        <h2 className="mb-3 text-sm font-bold text-ink">Notification senders</h2>
        <ul className="mb-3 divide-y divide-gray-100 text-sm">
          {senders.length === 0 && <li className="py-2 text-gray-400">No senders configured.</li>}
          {senders.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span className="text-gray-800">{s.type}: {s.identifier} <span className="text-xs text-gray-400">{s.provider ?? ""}</span></span>
              <form action={toggleSenderAction}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="status" value={s.status} /><button type="submit" className={s.status === "active" ? "rounded bg-brut-lime/40 px-2 py-1 text-xs text-ink" : "rounded bg-gray-100 px-2 py-1 text-xs text-gray-500"}>{s.status}</button></form>
            </li>
          ))}
        </ul>
        <form action={createSenderAction} className="flex gap-2">
          <select name="type" className="rounded border-[3px] border-ink px-2 py-1 text-sm"><option value="email">email</option><option value="sms">sms</option><option value="slack">slack</option></select>
          <input name="identifier" required placeholder="domain / number / app" className="flex-1 rounded border-[3px] border-ink px-2 py-1 text-sm" />
          <input name="provider" placeholder="provider" className="rounded border-[3px] border-ink px-2 py-1 text-sm" />
          <button type="submit" className="rounded border-2 border-ink bg-brut-yellow shadow-brut-sm px-3 py-1.5 text-sm font-medium text-ink">Add sender</button>
        </form>
      </section>
    </div>
  );
}
