"use client";

import { useId, useState, useTransition } from "react";
import { revealCredential, rotateCredential } from "./actions";

const btnGhost =
  "cursor-pointer rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 outline-none transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition-colors hover:border-zinc-400 focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40";

/**
 * Reveal + rotate controls for one stored credential. Both are deliberate,
 * audited senior-ops actions handled server-side. The revealed plaintext lives
 * only in transient component state, is shown on demand with copy-to-clipboard,
 * and is cleared on hide — it is never persisted, logged, or sent to audit.
 */
export function CredentialRowActions({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newSecret, setNewSecret] = useState("");
  const rotateInputId = useId();

  function handleReveal() {
    setError(null);
    startTransition(async () => {
      const res = await revealCredential(id);
      if (res.ok) {
        setSecret(res.secret);
      } else {
        setError(res.error);
      }
    });
  }

  function handleHide() {
    // Drop the plaintext from memory as soon as it's hidden.
    setSecret(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (secret == null) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — select and copy manually.");
    }
  }

  function handleRotate() {
    setError(null);
    startTransition(async () => {
      const res = await rotateCredential(id, newSecret);
      if (res.ok) {
        setRotating(false);
        setNewSecret("");
        setSecret(null);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center justify-end gap-2">
        {secret == null ? (
          <button type="button" onClick={handleReveal} disabled={pending} className={btnGhost}>
            {pending ? "Revealing…" : "Reveal"}
          </button>
        ) : (
          <button type="button" onClick={handleHide} className={btnGhost}>
            Hide
          </button>
        )}
        <button
          type="button"
          onClick={() => setRotating((v) => !v)}
          disabled={pending}
          className={btnGhost}
        >
          Rotate
        </button>
      </div>

      {secret != null && (
        <div className="flex items-center gap-2">
          <code className="max-w-[18rem] truncate rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-left font-mono text-xs text-zinc-800">
            {secret}
          </code>
          <button type="button" onClick={handleCopy} className={btnGhost}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {rotating && (
        <div className="flex items-center gap-2">
          <label htmlFor={rotateInputId} className="sr-only">
            New secret value
          </label>
          <input
            id={rotateInputId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={newSecret}
            onChange={(e) => setNewSecret(e.target.value)}
            placeholder="New secret value"
            className={`${inputClass} font-mono text-xs`}
          />
          <button
            type="button"
            onClick={handleRotate}
            disabled={pending || newSecret.length === 0}
            className={btnGhost}
          >
            {pending ? "Rotating…" : "Save"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-right text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
