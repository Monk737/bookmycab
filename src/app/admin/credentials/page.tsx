import "server-only";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { env } from "@/env";
import { requireStaff } from "@/lib/admin/guard";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { AddCredentialForm } from "./add-credential-form";
import { CredentialRowActions } from "./credential-row-actions";

// Always read fresh — a newly stored credential should appear immediately.
export const dynamic = "force-dynamic";

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  whatsapp_token: "WhatsApp token",
  telegram_token: "Telegram token",
  messenger_token: "Messenger token",
  instagram_token: "Instagram token",
  widget_secret: "Widget secret",
};

// A channel token within this window is treated as "expiring soon".
const EXPIRY_WARN_MS = 14 * 24 * 60 * 60 * 1000;

type CredentialRow = {
  id: string;
  tenant_id: string;
  channel_id: string | null;
  credential_type: string;
  created_at: string | null;
  last_accessed_at: string | null;
  tenants: { name: string } | { name: string }[] | null;
  channels:
    | { type: string; token_expires_at: string | null }
    | { type: string; token_expires_at: string | null }[]
    | null;
};

type ChannelOption = {
  id: string;
  type: string;
  tenant_id: string;
  tenant_name: string;
};

function rel<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Maps a channel's token_expires_at to an expiry badge status (or null). */
function expiryStatus(expiresAt: string | null): "expired" | "expiring" | null {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return null;
  const now = Date.now();
  if (t <= now) return "expired";
  if (t - now <= EXPIRY_WARN_MS) return "expiring";
  return null;
}

/**
 * Channel credentials vault (FlowMo staff). Lists every stored credential joined
 * to its tenant name + channel type via the service-role client (admin spans
 * tenants; RLS hard-denies this table to everyone but service_role). The raw
 * `secret_encrypted` column is NEVER selected or rendered — reveal is a separate
 * audited action. Defense-in-depth staff re-check (the admin layout also gates).
 */
export default async function CredentialsPage() {
  await requireStaff();

  const serviceClient = createSupabaseJS(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // NOTE: secret_encrypted is intentionally NOT in this select.
  const { data, error } = await serviceClient
    .from("channel_credentials")
    .select(
      "id, tenant_id, channel_id, credential_type, created_at, last_accessed_at, tenants(name), channels(type, token_expires_at)",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as CredentialRow[];

  // Channels (with tenant name) for the add-credential form selects.
  const { data: channelData } = await serviceClient
    .from("channels")
    .select("id, type, tenant_id, tenants(name)")
    .order("created_at", { ascending: false });

  const channels: ChannelOption[] = (
    (channelData ?? []) as Array<{
      id: string;
      type: string;
      tenant_id: string;
      tenants: { name: string } | { name: string }[] | null;
    }>
  ).map((c) => ({
    id: c.id,
    type: c.type,
    tenant_id: c.tenant_id,
    tenant_name: rel(c.tenants)?.name ?? "—",
  }));

  const expiringCount = rows.reduce((n, r) => {
    const status = expiryStatus(rel(r.channels)?.token_expires_at ?? null);
    return status ? n + 1 : n;
  }, 0);

  const columns: Column<CredentialRow>[] = [
    {
      key: "tenant",
      header: "Tenant",
      render: (r) => rel(r.tenants)?.name ?? "—",
    },
    {
      key: "channel",
      header: "Channel",
      render: (r) => (
        <span className="capitalize">{rel(r.channels)?.type ?? "—"}</span>
      ),
    },
    {
      key: "credential_type",
      header: "Credential",
      render: (r) =>
        CREDENTIAL_TYPE_LABELS[r.credential_type] ?? r.credential_type,
    },
    {
      key: "token_expiry",
      header: "Token",
      render: (r) => {
        const expiresAt = rel(r.channels)?.token_expires_at ?? null;
        const status = expiryStatus(expiresAt);
        if (status === "expired") return <StatusBadge status="expired" />;
        if (status === "expiring") return <StatusBadge status="expiring" />;
        return <span className="text-zinc-400">OK</span>;
      },
    },
    {
      key: "created_at",
      header: "Created",
      render: (r) => formatDateTime(r.created_at),
    },
    {
      key: "last_accessed_at",
      header: "Last accessed",
      render: (r) => formatDateTime(r.last_accessed_at),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (r) => <CredentialRowActions id={r.id} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          Credentials vault
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Encrypted channel secrets. Reveal and rotate are deliberate,
          audited senior-ops actions — raw values are never listed.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Stored credentials" value={rows.length} />
        <StatCard label="Token expiring / expired" value={expiringCount} />
        <StatCard label="Channels" value={channels.length} />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Failed to load credentials. Please refresh.
        </p>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Add credential
        </h2>
        <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-5">
          <AddCredentialForm channels={channels} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Stored credentials
        </h2>
        <div className="mt-3">
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            emptyMessage="No credentials stored yet."
          />
        </div>
      </div>
    </div>
  );
}
