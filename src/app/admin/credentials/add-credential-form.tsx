"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { addCredential, type ActionState } from "./actions";
import { CREDENTIAL_TYPES } from "./credential-types";

type ChannelOption = {
  id: string;
  type: string;
  tenant_id: string;
  tenant_name: string;
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  whatsapp_token: "WhatsApp token",
  telegram_token: "Telegram token",
  messenger_token: "Messenger token",
  instagram_token: "Instagram token",
  widget_secret: "Widget secret",
};

// Sensible default credential type per channel type (still fully editable).
const DEFAULT_TYPE_FOR_CHANNEL: Record<string, string> = {
  whatsapp: "whatsapp_token",
  telegram: "telegram_token",
  messenger: "messenger_token",
  instagram: "instagram_token",
  widget: "widget_secret",
};

const initialState: ActionState = { fieldErrors: {}, formError: null };

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40";

function fieldWrap(label: string, id: string, children: React.ReactNode, error?: string | null) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Add-credential form. Picks a channel (which carries its tenant) + credential
 * type + the secret value, then calls the `addCredential` server action, which
 * encrypts the secret server-side via the vault. The secret input is masked and
 * its value never leaves this form except in the submitted FormData.
 */
export function AddCredentialForm({ channels }: { channels: ChannelOption[] }) {
  const [state, formAction, pending] = useActionState(addCredential, initialState);

  const formRef = useRef<HTMLFormElement>(null);
  // On a successful store, reset the form so the masked secret value doesn't
  // linger in the DOM longer than necessary. The success banner stays (driven
  // by state.ok), and the controlled channel/type selects keep their values.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const channelId = useId();
  const typeId = useId();
  const secretId = useId();

  const [selectedChannel, setSelectedChannel] = useState(channels[0]?.id ?? "");
  const channelType = useMemo(
    () => channels.find((c) => c.id === selectedChannel)?.type ?? "",
    [channels, selectedChannel],
  );
  const [credentialType, setCredentialType] = useState<string>(
    DEFAULT_TYPE_FOR_CHANNEL[channels[0]?.type ?? ""] ?? CREDENTIAL_TYPES[0],
  );

  const fe = state.fieldErrors;
  const selected = channels.find((c) => c.id === selectedChannel);

  if (channels.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No channels exist yet. Provision a channel before storing a credential.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      {state.formError && (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.formError}
        </p>
      )}
      {state.ok && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          Credential stored.
        </p>
      )}

      {/* tenant_id rides along with the chosen channel (a channel belongs to one tenant). */}
      <input type="hidden" name="tenant_id" value={selected?.tenant_id ?? ""} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {fieldWrap(
          "Channel",
          channelId,
          <select
            id={channelId}
            name="channel_id"
            value={selectedChannel}
            onChange={(e) => {
              const next = e.target.value;
              setSelectedChannel(next);
              const t = channels.find((c) => c.id === next)?.type ?? "";
              const def = DEFAULT_TYPE_FOR_CHANNEL[t];
              if (def) setCredentialType(def);
            }}
            aria-invalid={fe.channel_id?.[0] ? true : undefined}
            className={`${inputClass} ${fe.channel_id?.[0] ? "border-red-400" : ""}`}
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tenant_name} · {c.type}
              </option>
            ))}
          </select>,
          fe.channel_id?.[0],
        )}

        {fieldWrap(
          "Credential type",
          typeId,
          <select
            id={typeId}
            name="credential_type"
            value={credentialType}
            onChange={(e) => setCredentialType(e.target.value)}
            aria-invalid={fe.credential_type?.[0] ? true : undefined}
            className={`${inputClass} ${fe.credential_type?.[0] ? "border-red-400" : ""}`}
          >
            {CREDENTIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {CREDENTIAL_TYPE_LABELS[t]}
              </option>
            ))}
          </select>,
          fe.credential_type?.[0],
        )}

        {fieldWrap(
          "Secret value",
          secretId,
          <input
            id={secretId}
            name="secret"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the token / secret"
            aria-invalid={fe.secret?.[0] ? true : undefined}
            className={`${inputClass} font-mono ${fe.secret?.[0] ? "border-red-400" : ""}`}
          />,
          fe.secret?.[0],
        )}
      </div>

      {channelType && DEFAULT_TYPE_FOR_CHANNEL[channelType] !== credentialType && (
        <p className="text-xs text-amber-600" role="note">
          Heads up: this credential type doesn&apos;t match the selected channel&apos;s
          type. Double-check before storing.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white outline-none transition-colors hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Storing…" : "Store credential"}
        </button>
      </div>
    </form>
  );
}
