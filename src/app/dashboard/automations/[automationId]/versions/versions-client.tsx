"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Version { id: string; version: number; status: string; change_note: string | null; published_at: string | null; created_at: string }

export function VersionsClient(props: { orgId: string; automationId: string; versions: Version[]; isDemo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/api/orgs/${props.orgId}/automations/${props.automationId}`;

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422 && Array.isArray(b.violations)) setMsg(`Blocked by guardrails: ${b.violations.map((v: { field: string; reason: string }) => `${v.field} (${v.reason})`).join(", ")}`);
        else setMsg(typeof b.error === "string" ? b.error : `Failed (${res.status})`);
      } else router.refresh();
    } catch { setMsg("Network error."); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {!props.isDemo && (
          <button disabled={busy} onClick={() => call(`${base}/config/versions`, "POST", {})} className="rounded bg-blue-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Snapshot live config as draft
          </button>
        )}
        {msg && <span className="text-sm text-red-600" role="alert">{msg}</span>}
      </div>
      <table className="min-w-full rounded-lg border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>{["Version", "Status", "Note", "Published", ""].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {props.versions.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No versions yet.</td></tr>}
          {props.versions.map((v) => (
            <tr key={v.id}>
              <td className="px-3 py-2 text-gray-800">v{v.version}</td>
              <td className="px-3 py-2"><span className={v.status === "published" ? "text-emerald-600" : v.status === "draft" ? "text-amber-600" : "text-gray-400"}>{v.status}</span></td>
              <td className="px-3 py-2 text-gray-500">{v.change_note ?? "—"}</td>
              <td className="px-3 py-2 text-gray-400">{v.published_at ? new Date(v.published_at).toLocaleString("en-GB") : "—"}</td>
              <td className="px-3 py-2 text-right">
                {!props.isDemo && (
                  <span className="flex justify-end gap-1">
                    {v.status === "draft" && <button disabled={busy} onClick={() => call(`${base}/config/versions/${v.id}`, "POST")} className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white">Publish</button>}
                    {v.status !== "draft" && <button disabled={busy} onClick={() => call(`${base}/config/rollback`, "POST", { versionId: v.id })} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">Roll back to this</button>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
