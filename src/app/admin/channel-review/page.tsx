import { requireStaff } from "@/lib/admin/guard";
import { listPendingChannels } from "@/lib/channels/service";
import { approveChannelAction, rejectChannelAction } from "./actions";

export const metadata = { title: "Channel review — Admin" };

export default async function ChannelReviewPage() {
  await requireStaff();
  const pending = await listPendingChannels();
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Channel review</h1>
      <p className="mb-4 text-sm text-slate-500">Approve or reject tenant-requested channels.</p>
      <table className="min-w-full rounded-lg border border-slate-200 text-sm">
        <thead className="bg-slate-50"><tr>{["Tenant", "Type", "Identifier", "Requested", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-slate-700">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">
          {pending.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">No channels awaiting review.</td></tr>}
          {pending.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-slate-500">{c.tenant_id.slice(0, 8)}&hellip;</td>
              <td className="px-3 py-2 capitalize text-slate-800">{c.type}</td>
              <td className="px-3 py-2 text-slate-700">{c.external_id ?? "—"}</td>
              <td className="px-3 py-2 text-slate-400">{new Date(c.created_at).toLocaleString("en-GB")}</td>
              <td className="px-3 py-2 text-right">
                <span className="flex justify-end gap-1">
                  <form action={approveChannelAction}><input type="hidden" name="channelId" value={c.id} /><button type="submit" className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Approve</button></form>
                  <form action={rejectChannelAction}><input type="hidden" name="channelId" value={c.id} /><button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700">Reject</button></form>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
