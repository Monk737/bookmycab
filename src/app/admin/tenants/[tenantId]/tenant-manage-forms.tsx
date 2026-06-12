"use client";

import { useActionState, useId, useState } from "react";
import {
  editOrgProfile,
  createAutomation,
  setMemberRole,
  removeMember,
  type ActionState,
} from "./actions";

const initialState: ActionState = { fieldErrors: {}, formError: null };

const inputClass =
  "border-[3px] border-ink bg-paper px-3 py-2 text-sm text-ink placeholder:text-gray-400 outline-none transition-colors hover:border-gray-400 focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink";

const primaryBtn =
  "brut-press inline-flex h-10 cursor-pointer items-center border-[3px] border-ink bg-brut-cyan px-4 text-sm font-bold uppercase tracking-[0.04em] text-ink shadow-brut-sm disabled:cursor-not-allowed disabled:opacity-60";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-brut-red-deep">
      {error}
    </p>
  );
}

function Notice({ state, okText }: { state: ActionState; okText: string }) {
  if (state.formError) {
    return (
      <p role="alert" aria-live="polite" className="border-2 border-ink bg-brut-red/15 px-3 py-2 text-sm text-brut-red-deep">
        {state.formError}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" aria-live="polite" className="border-2 border-ink bg-brut-lime/30 px-3 py-2 text-sm font-medium text-ink">
        {okText}
      </p>
    );
  }
  return null;
}

/* -------------------------------------------------------------------------- */

/** Edit the organisation profile: name, contact email, dispatch binding. */
export function EditOrgForm({
  tenantId,
  name,
  contactEmail,
  dispatchAdapter,
  dispatchCompanyId,
}: {
  tenantId: string;
  name: string;
  contactEmail: string | null;
  dispatchAdapter: string;
  dispatchCompanyId: string | null;
}) {
  const [state, formAction, pending] = useActionState(editOrgProfile.bind(null, tenantId), initialState);
  const nameId = useId();
  const emailId = useId();
  const adapterId = useId();
  const companyId = useId();
  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Notice state={state} okText="Organisation updated." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-gray-700">Organisation name</label>
          <input id={nameId} name="name" defaultValue={name} className={inputClass} />
          <FieldError id={`${nameId}-error`} error={fe.name?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-sm font-medium text-gray-700">Contact email</label>
          <input id={emailId} name="contact_email" type="email" defaultValue={contactEmail ?? ""} className={inputClass} />
          <FieldError id={`${emailId}-error`} error={fe.contact_email?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={adapterId} className="text-sm font-medium text-gray-700">Dispatch adapter</label>
          <select id={adapterId} name="dispatch_adapter" defaultValue={dispatchAdapter} className={inputClass}>
            <option value="autocab">AutoCab</option>
            <option value="icabbi">iCabbi</option>
            <option value="cordic">Cordic</option>
          </select>
          <FieldError id={`${adapterId}-error`} error={fe.dispatch_adapter?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={companyId} className="text-sm font-medium text-gray-700">Dispatch company ID</label>
          <input id={companyId} name="dispatch_company_id" defaultValue={dispatchCompanyId ?? ""} placeholder="Optional" className={inputClass} />
        </div>
      </div>
      <div>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : "Save organisation"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

const ROLE_FILL: Record<string, string> = {
  Owner: "bg-brut-yellow",
  Admin: "bg-brut-cyan",
  Viewer: "bg-gray-200",
};

export type Member = {
  user_id: string;
  email: string;
  role: string;
  accepted_at: string | null;
  last_login_at: string | null;
};

/** Per-member management: inline role change + remove (last-Owner protected server-side). */
export function MembersManager({ tenantId, members }: { tenantId: string; members: Member[] }) {
  if (members.length === 0) {
    return (
      <div className="border-[3px] border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
        No users yet. Invite one below.
      </div>
    );
  }
  return (
    <div className="overflow-hidden border-[3px] border-ink">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {["User", "Role", "Accepted", "Last login", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-bold text-gray-700">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-gray-100">
          {members.map((m) => (
            <tr key={m.user_id}>
              <td className="px-3 py-2 font-medium text-ink">{m.email}</td>
              <td className="px-3 py-2">
                <form action={setMemberRole.bind(null, tenantId, m.user_id)} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 border-2 border-ink ${ROLE_FILL[m.role] ?? "bg-gray-200"}`} aria-hidden="true" />
                  <select
                    name="role"
                    defaultValue={m.role}
                    aria-label={`Role for ${m.email}`}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </form>
              </td>
              <td className="px-3 py-2 text-gray-600">{m.accepted_at ? "Yes" : <span className="text-brut-orange">Pending</span>}</td>
              <td className="px-3 py-2 tabular-nums text-gray-600">
                {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "·"}
              </td>
              <td className="px-3 py-2 text-right">
                <form action={removeMember.bind(null, tenantId, m.user_id)} className="inline">
                  <button
                    type="submit"
                    onClick={(e) => {
                      if (!confirm(`Remove ${m.email} from this organisation?`)) e.preventDefault();
                    }}
                    className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10"
                  >
                    Remove
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const CHAT_TYPES = ["Booking", "Support", "Driver", "Custom"] as const;

/** Manually provision an automation (Chat bot or Voice agent) for the tenant. */
export function AddAutomationForm({ tenantId, hasVoicePlan }: { tenantId: string; hasVoicePlan: boolean }) {
  const [state, formAction, pending] = useActionState(createAutomation.bind(null, tenantId), initialState);
  const [type, setType] = useState<string>("Booking");
  const isVoice = type === "Voice";
  const nameId = useId();
  const typeId = useId();
  const adapterId = useId();
  const phoneId = useId();
  const channelId = useId();
  const handleId = useId();
  const tierId = useId();
  const workflowId = useId();
  const assistantId = useId();
  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Notice state={state} okText="Automation created (status: building)." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={typeId} className="text-sm font-medium text-gray-700">Type</label>
          <select id={typeId} name="type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <optgroup label="Chat">
              {CHAT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </optgroup>
            <optgroup label="Voice">
              <option value="Voice">AI Voice agent</option>
            </optgroup>
          </select>
          <FieldError id={`${typeId}-error`} error={fe.type?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-gray-700">{isVoice ? "Agent name" : "Automation name"}</label>
          <input id={nameId} name="name" placeholder={isVoice ? "Daytime Booking Line" : "Omnichannel Booking Bot"} className={inputClass} />
          <FieldError id={`${nameId}-error`} error={fe.name?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={adapterId} className="text-sm font-medium text-gray-700">Dispatch adapter</label>
          <select id={adapterId} name="dispatch_adapter" defaultValue="autocab" className={inputClass}>
            <option value="autocab">AutoCab</option>
            <option value="icabbi">iCabbi</option>
            <option value="cordic">Cordic</option>
          </select>
        </div>

        {isVoice ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={phoneId} className="text-sm font-medium text-gray-700">Phone number</label>
              <input id={phoneId} name="phone_number" placeholder="+44 20 7946 0001" className={inputClass} />
              <FieldError id={`${phoneId}-error`} error={fe.phone_number?.[0]} />
            </div>
            {!hasVoicePlan && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={tierId} className="text-sm font-medium text-gray-700">Voice plan tier</label>
                <select id={tierId} name="voice_tier" defaultValue="ignition" className={inputClass}>
                  <option value="ignition">Ignition — 1,500 calls / 1 agent</option>
                  <option value="in_motion">In Motion — 2,250 calls / 2 agents</option>
                  <option value="full_throttle">Full Throttle — 3,000 calls / 2 agents</option>
                </select>
                <FieldError id={`${tierId}-error`} error={fe.voice_tier?.[0]} />
                <p className="text-xs text-gray-500">This tenant has no voice plan yet — adding an agent provisions one and unlocks the AI Voice dashboard.</p>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={workflowId} className="text-sm font-medium text-gray-700">Engine workflow ID (optional)</label>
              <input id={workflowId} name="engine_workflow_id" placeholder="n8n workflow id, e.g. 0x5hOeCgWfr3N7pR" className={inputClass} />
              <p className="text-xs text-gray-500">The tenant&rsquo;s cloned voice workflow. Providing it activates the agent immediately (status: live).</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={assistantId} className="text-sm font-medium text-gray-700">Vapi assistant ID (optional)</label>
              <input id={assistantId} name="vapi_assistant_id" placeholder="e.g. 15c5709f-7585-4d39-96cf-ffe85e42bd40" className={inputClass} />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={channelId} className="text-sm font-medium text-gray-700">Bind a channel (optional)</label>
              <select id={channelId} name="channel_type" defaultValue="" className={inputClass}>
                <option value="">No channel yet</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telegram">Telegram</option>
                <option value="messenger">Messenger</option>
                <option value="instagram">Instagram</option>
                <option value="widget">Web widget</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={handleId} className="text-sm font-medium text-gray-700">Channel handle (optional)</label>
              <input id={handleId} name="channel_handle" placeholder="+44 7700 900100 / @handle" className={inputClass} />
            </div>
          </>
        )}
      </div>
      <div>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Creating…" : isVoice ? "Add voice agent" : "Add automation"}
        </button>
      </div>
    </form>
  );
}
