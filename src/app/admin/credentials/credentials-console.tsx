"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FIELDS,
  PRODUCT_LABEL,
  PRODUCTS,
  fieldLabel,
  isSecretField,
  type CredProduct,
} from "@/lib/credentials/integration-fields";
import type { CredInstance } from "@/lib/credentials/integration-service";
import {
  addCredentialInstance,
  addCredentialValue,
  deleteCredentialInstance,
  deleteCredentialValue,
  updateCredentialValue,
  type CredActionState,
} from "./integration-actions";

const inputClass =
  "w-full border-2 border-ink bg-paper px-2.5 py-1.5 text-sm text-ink placeholder:text-gray-400 outline-none focus-visible:ring-2 focus-visible:ring-ink";

const btnGhost =
  "cursor-pointer border-2 border-ink bg-paper px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] text-ink transition-colors hover:bg-canvas";

export function CredentialsConsole({
  tenants,
  selectedTenantId,
  selectedTenantName,
  instances,
}: {
  tenants: { id: string; name: string }[];
  selectedTenantId: string | null;
  selectedTenantName: string | null;
  instances: CredInstance[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"manage" | "add">("manage");

  return (
    <div className="mt-6">
      {/* Tenant selector */}
      <div className="flex flex-wrap items-end gap-4 border-[3px] border-ink bg-paper p-4 shadow-brut">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-600">Tenant company</span>
          <select
            value={selectedTenantId ?? ""}
            onChange={(e) => router.push(`/admin/credentials?tenant=${e.target.value}`)}
            className={`${inputClass} min-w-[16rem]`}
          >
            <option value="" disabled>Select a tenant…</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        {selectedTenantId && (
          <div className="flex border-2 border-ink">
            {(["manage", "add"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-[0.04em] transition-colors ${
                  tab === t ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-canvas"
                }`}
              >
                {t === "manage" ? "View & edit" : "Add credentials"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedTenantId ? (
        <p className="mt-8 text-center text-sm text-gray-600">
          Choose a tenant company above to view or add its integration credentials.
        </p>
      ) : tab === "add" ? (
        <AddCredentials tenantId={selectedTenantId} onSaved={() => { setTab("manage"); router.refresh(); }} />
      ) : (
        <ManageCredentials tenantId={selectedTenantId} tenantName={selectedTenantName} instances={instances} />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Add                                                                         */
/* -------------------------------------------------------------------------- */

function AddCredentials({ tenantId, onSaved }: { tenantId: string; onSaved: () => void }) {
  const [product, setProduct] = useState<CredProduct>("voice");
  const [state, formAction, pending] = useActionState<CredActionState, FormData>(addCredentialInstance, { error: null });
  // Per-field count of extra value inputs (beyond the first), keyed by field.
  const [extra, setExtra] = useState<Record<string, number>>({});

  // On a successful save, switch to the manage tab and refresh.
  useEffect(() => {
    if (state.ok) onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.ok]);

  return (
    <form action={formAction} className="mt-6 border-[3px] border-ink bg-paper p-5 shadow-brut">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="product" value={product} />

      {state.error && (
        <p role="alert" className="mb-4 border-2 border-ink bg-brut-red/15 px-3 py-2 text-sm text-brut-red-deep">{state.error}</p>
      )}

      {/* Product toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-600">Product</span>
        <div className="flex border-2 border-ink">
          {PRODUCTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setProduct(p); setExtra({}); }}
              className={`cursor-pointer px-3 py-1.5 text-xs font-bold uppercase tracking-[0.04em] transition-colors ${
                product === p ? (p === "voice" ? "bg-brut-cyan text-ink" : "bg-brut-lime text-ink") : "bg-paper text-ink hover:bg-canvas"
              }`}
            >
              {PRODUCT_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 flex max-w-sm flex-col gap-1.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-600">Instance label</span>
        <input name="instance_label" defaultValue="Primary" placeholder="e.g. Primary, Daytime agent" className={inputClass} />
        <span className="text-xs text-gray-500">Name this set so a tenant can hold more than one (e.g. two voice agents).</span>
      </label>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {FIELDS[product].map((f) => {
          const count = 1 + (extra[f.key] ?? 0);
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-700">
                {f.label}
                {f.secret && <span className="ml-1.5 border border-ink bg-brut-yellow px-1 py-0.5 text-[9px] font-bold uppercase text-ink">secret</span>}
              </span>
              {Array.from({ length: count }).map((_, i) => (
                <input key={i} name={`value.${f.key}`} placeholder={f.placeholder ?? f.label} autoComplete="off" className={inputClass} />
              ))}
              <button
                type="button"
                onClick={() => setExtra((e) => ({ ...e, [f.key]: (e[f.key] ?? 0) + 1 }))}
                className="self-start text-xs font-bold uppercase tracking-[0.04em] text-ink underline decoration-2 underline-offset-2 hover:bg-brut-yellow"
              >
                + Add another
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button type="submit" disabled={pending} className="cursor-pointer border-[3px] border-ink bg-brut-cyan px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut-sm disabled:opacity-60">
          {pending ? "Saving…" : "Save credentials"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Manage (view + edit)                                                        */
/* -------------------------------------------------------------------------- */

function ManageCredentials({
  tenantId,
  tenantName,
  instances,
}: {
  tenantId: string;
  tenantName: string | null;
  instances: CredInstance[];
}) {
  if (instances.length === 0) {
    return (
      <div className="mt-6 border-[3px] border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center">
        <p className="font-display text-base font-extrabold uppercase tracking-tight text-ink">No credentials stored yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-gray-600">
          Use “Add credentials” to store {tenantName ?? "this tenant"}&rsquo;s WhatsApp and AI Voice integration keys.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 space-y-6">
      {instances.map((inst) => (
        <InstanceCard key={`${inst.product}-${inst.label}`} tenantId={tenantId} inst={inst} />
      ))}
    </div>
  );
}

function InstanceCard({ tenantId, inst }: { tenantId: string; inst: CredInstance }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const accent = inst.product === "voice" ? "bg-brut-cyan" : "bg-brut-lime";
  // Group values by field key.
  const byField = new Map<string, typeof inst.values>();
  for (const v of inst.values) {
    const arr = byField.get(v.fieldKey) ?? [];
    arr.push(v);
    byField.set(v.fieldKey, arr);
  }
  const schemaKeys = FIELDS[inst.product].map((f) => f.key);
  const extraKeys = [...byField.keys()].filter((k) => !schemaKeys.includes(k));

  return (
    <section className="border-[3px] border-ink bg-paper shadow-brut">
      <header className={`flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink px-5 py-3 ${accent}`}>
        <div className="flex items-center gap-3">
          <h3 className="font-display text-sm font-extrabold uppercase tracking-tight text-ink">{PRODUCT_LABEL[inst.product]}</h3>
          <span className="border-2 border-ink bg-paper px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-ink">{inst.label}</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`Delete the "${inst.label}" ${PRODUCT_LABEL[inst.product]} credentials? This removes all its values.`)) return;
            start(async () => {
              try { await deleteCredentialInstance({ tenantId, product: inst.product, label: inst.label }); router.refresh(); }
              catch (e) { alert(e instanceof Error ? e.message : "Failed to delete."); }
            });
          }}
          className="cursor-pointer border-2 border-ink bg-paper px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10"
        >
          Delete instance
        </button>
      </header>
      <div className="divide-y-2 divide-gray-100">
        {FIELDS[inst.product].map((f) => (
          <FieldRow key={f.key} tenantId={tenantId} product={inst.product} label={inst.label} fieldKey={f.key} title={f.label} secret={!!f.secret} values={byField.get(f.key) ?? []} />
        ))}
        {extraKeys.map((k) => (
          <FieldRow key={k} tenantId={tenantId} product={inst.product} label={inst.label} fieldKey={k} title={fieldLabel(inst.product, k)} secret={isSecretField(inst.product, k)} values={byField.get(k) ?? []} />
        ))}
      </div>
    </section>
  );
}

function FieldRow({
  tenantId,
  product,
  label,
  fieldKey,
  title,
  secret,
  values,
}: {
  tenantId: string;
  product: CredProduct;
  label: string;
  fieldKey: string;
  title: string;
  secret: boolean;
  values: { id: string; value: string | null }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-2 px-5 py-3 sm:grid-cols-[14rem_1fr] sm:gap-5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {title}
        {secret && <span className="border border-ink bg-brut-yellow px-1 py-0.5 text-[9px] font-bold uppercase text-ink">secret</span>}
      </p>
      <div className="min-w-0 space-y-2">
        {values.length === 0 && <p className="text-xs text-gray-400">Not set</p>}
        {values.map((v) => (
          <ValueRow key={v.id} id={v.id} tenantId={tenantId} value={v.value ?? ""} secret={secret} />
        ))}
        <div className="flex items-center gap-2">
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add a value…"
            autoComplete="off"
            className={`${inputClass} max-w-md`}
          />
          <button
            type="button"
            disabled={pending || !adding.trim()}
            onClick={() => start(async () => {
              try { await addCredentialValue({ tenantId, product, label, fieldKey, value: adding }); setAdding(""); router.refresh(); }
              catch (e) { alert(e instanceof Error ? e.message : "Failed to add."); }
            })}
            className={`${btnGhost} disabled:opacity-50`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueRow({ id, tenantId, value, secret }: { id: string; tenantId: string; value: string; secret: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const masked = secret && !reveal ? "•".repeat(Math.min(20, Math.max(8, value.length))) : value;

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" className={`${inputClass} max-w-md font-mono`} />
        <button type="button" disabled={pending} onClick={() => start(async () => {
          try { await updateCredentialValue(id, tenantId, draft); setEditing(false); router.refresh(); }
          catch (e) { alert(e instanceof Error ? e.message : "Failed to save."); }
        })} className="cursor-pointer border-2 border-ink bg-brut-lime px-2.5 py-1 text-xs font-bold uppercase tracking-[0.04em] text-ink">Save</button>
        <button type="button" onClick={() => { setDraft(value); setEditing(false); }} className="cursor-pointer px-2 py-1 text-xs font-medium text-gray-600 hover:text-ink">Cancel</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate border-2 border-gray-200 bg-canvas px-2.5 py-1.5 text-xs text-ink">{masked || "—"}</code>
      {secret && (
        <button type="button" onClick={() => setReveal((r) => !r)} className={btnGhost} aria-label={reveal ? "Hide" : "Reveal"}>{reveal ? "Hide" : "Show"}</button>
      )}
      <button type="button" onClick={() => setEditing(true)} className={btnGhost}>Edit</button>
      <button
        type="button"
        disabled={pending}
        onClick={() => { if (confirm("Delete this value?")) start(async () => { try { await deleteCredentialValue(id, tenantId); router.refresh(); } catch (e) { alert(e instanceof Error ? e.message : "Failed."); } }); }}
        className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10"
      >
        Del
      </button>
    </div>
  );
}
