"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  editOrgProfile,
  createAutomation,
  updateAutomationWiring,
  updateCustomPlan,
  setMemberRole,
  removeMember,
  deleteAutomation,
  forceDeleteAutomation,
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
  const router = useRouter();
  const [pending, start] = useTransition();

  // Run a member mutation that may throw (e.g. the last-Owner guard) and surface
  // the message as an alert instead of letting it bubble to Next's error page.
  const run = (fn: () => Promise<void>, fallback: string) =>
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : fallback);
        router.refresh();
      }
    });

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
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 border-2 border-ink ${ROLE_FILL[m.role] ?? "bg-gray-200"}`} aria-hidden="true" />
                  <select
                    value={m.role}
                    disabled={pending}
                    aria-label={`Role for ${m.email}`}
                    onChange={(e) => {
                      const role = e.target.value;
                      const fd = new FormData();
                      fd.set("role", role);
                      run(() => setMemberRole(tenantId, m.user_id, fd), "Could not change the role.");
                    }}
                    className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600">{m.accepted_at ? "Yes" : <span className="text-brut-orange">Pending</span>}</td>
              <td className="px-3 py-2 tabular-nums text-gray-600">
                {m.last_login_at ? new Date(m.last_login_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "·"}
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Remove ${m.email} from this organisation?`)) return;
                    run(() => removeMember(tenantId, m.user_id), "Could not remove the member.");
                  }}
                  className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10 disabled:opacity-60"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Per-row delete for an automation. The server action refuses automations with
 * booking/call/conversation history, so this is safe for orphaned/never-used
 * records; confirm() guards accidental clicks. Errors surface via alert().
 */
export function DeleteAutomationButton({
  tenantId,
  automationId,
  name,
}: {
  tenantId: string;
  automationId: string;
  name: string;
}) {
  return (
    <form
      action={async () => {
        try {
          await deleteAutomation(tenantId, automationId);
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to delete the automation.");
        }
      }}
      className="inline"
    >
      <button
        type="submit"
        onClick={(e) => {
          if (!confirm(`Delete the "${name}" automation? This removes its agent and channel wiring.`)) {
            e.preventDefault();
          }
        }}
        className="cursor-pointer border-2 border-ink bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10"
      >
        Delete
      </button>
    </form>
  );
}

/**
 * Per-row FORCE delete for an automation that has data (bookings/calls/etc).
 * Two-step: the first click arms the control, the second wipes the automation
 * and all its history via forceDeleteAutomation. Used in place of the simple
 * Delete only when the automation actually has records to destroy.
 */
export function ForceDeleteAutomationButton({
  tenantId,
  automationId,
  name,
}: {
  tenantId: string;
  automationId: string;
  name: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        title={`"${name}" has data; force delete wipes its history`}
        className="cursor-pointer border-2 border-brut-red-deep bg-paper px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-brut-red-deep transition-colors hover:bg-brut-red/10"
      >
        Force delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-brut-red-deep">Wipes all data:</span>
      <form
        action={async () => {
          try {
            await forceDeleteAutomation(tenantId, automationId);
          } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to force-delete the automation.");
            setArmed(false);
          }
        }}
        className="inline"
      >
        <button
          type="submit"
          className="cursor-pointer border-2 border-brut-red-deep bg-brut-red-deep px-2 py-1 text-xs font-bold uppercase tracking-[0.04em] text-paper transition-opacity hover:opacity-90"
        >
          Confirm wipe
        </button>
      </form>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="cursor-pointer px-1.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:text-ink"
      >
        Cancel
      </button>
    </span>
  );
}

/* -------------------------------------------------------------------------- */

const CHAT_TYPES = ["Booking", "Support", "Driver", "Custom"] as const;

/** Manually provision an automation (Chat bot or Voice agent) for the tenant. */
export function AddAutomationForm({ tenantId, hasVoicePlan }: { tenantId: string; hasVoicePlan: boolean }) {
  const [state, formAction, pending] = useActionState(createAutomation.bind(null, tenantId), initialState);
  // Default to the tenant's provisioned product: a tenant with a voice plan
  // almost always wants a Voice agent next (creating a chat "Booking"
  // automation for a voice tenant yields an orphan with no agent/channel and
  // hides the Engine wiring panel). Chat-only tenants default to Booking.
  const [type, setType] = useState<string>(hasVoicePlan ? "Voice" : "Booking");
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
  const voiceNoteId = useId();
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
              <div className="flex flex-col gap-1.5 border-[3px] border-ink bg-brut-yellow/10 px-4 py-3">
                <p className="text-sm font-medium text-ink">Provisions the AI Voice Ignition plan</p>
                <p className="text-xs text-gray-600">
                  1,000 calls / 1 agent, £1,999/mo. This tenant has no voice plan yet — adding an agent provisions Ignition and unlocks the AI Voice dashboard. For a bespoke allowance, set up a Custom plan at tenant creation instead.
                </p>
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor={workflowId} className="text-sm font-medium text-gray-700">Chat workflow ID (optional)</label>
              <input id={workflowId} name="engine_workflow_id" placeholder="n8n WhatsApp Chat workflow id, e.g. bLWWbiAcchP6XCaS" className={inputClass} />
              <p className="text-xs text-gray-500">The tenant&rsquo;s cloned WhatsApp Chat workflow. Save it in Engine wiring to take the bot live.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={voiceNoteId} className="text-sm font-medium text-gray-700">Voice-Note workflow ID (optional)</label>
              <input id={voiceNoteId} name="voice_note_workflow_id" placeholder="paired Voice-Note sub-workflow id, e.g. XlJFrnOXVyMOLqdY" className={inputClass} />
              <p className="text-xs text-gray-500">The transcription twin the chat workflow calls for WhatsApp voice notes. Reference only.</p>
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

/* -------------------------------------------------------------------------- */

/**
 * Wire (or re-wire) an existing automation to its engine pair. Two variants:
 *  - voice: the cloned n8n workflow id + the Vapi assistant id.
 *  - chat:  the cloned WhatsApp Chat workflow id + the paired Voice-Note
 *           sub-workflow id (no Vapi — a voice note is not a phone call).
 * Saving a workflow id on a still-building automation takes it live. Rendered
 * inside the "Engine wiring" panel on the tenant detail page.
 */
export function EngineWiringForm({
  tenantId,
  automationId,
  engineWorkflowId,
  vapiAssistantId,
  voiceNoteWorkflowId,
  variant = "voice",
}: {
  tenantId: string;
  automationId: string;
  engineWorkflowId: string | null;
  vapiAssistantId?: string | null;
  voiceNoteWorkflowId?: string | null;
  variant?: "voice" | "chat";
}) {
  const [state, formAction, pending] = useActionState(updateAutomationWiring.bind(null, tenantId), initialState);
  const wfId = useId();
  const secondId = useId();
  const fe = state.fieldErrors;
  const isChat = variant === "chat";

  return (
    <form action={formAction} noValidate className="mt-3 flex flex-col gap-3 border-t-2 border-gray-200 pt-3">
      <Notice state={state} okText="Engine wiring saved." />
      <input type="hidden" name="automation_id" value={automationId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={wfId} className="text-xs font-medium text-gray-600">
            {isChat ? "Chat workflow ID" : "n8n workflow ID"}
          </label>
          <input id={wfId} name="engine_workflow_id" defaultValue={engineWorkflowId ?? ""} placeholder={isChat ? "e.g. bLWWbiAcchP6XCaS" : "e.g. 0x5hOeCgWfr3N7pR"} className={inputClass} />
          <FieldError id={`${wfId}-error`} error={fe.engine_workflow_id?.[0]} />
        </div>
        {isChat ? (
          <div className="flex flex-col gap-1">
            <label htmlFor={secondId} className="text-xs font-medium text-gray-600">Voice-Note workflow ID</label>
            <input id={secondId} name="voice_note_workflow_id" defaultValue={voiceNoteWorkflowId ?? ""} placeholder="e.g. XlJFrnOXVyMOLqdY" className={inputClass} />
            <FieldError id={`${secondId}-error`} error={fe.voice_note_workflow_id?.[0]} />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor={secondId} className="text-xs font-medium text-gray-600">Vapi assistant ID</label>
            <input id={secondId} name="vapi_assistant_id" defaultValue={vapiAssistantId ?? ""} placeholder="e.g. 15c5709f-7585-4d39-…" className={inputClass} />
            <FieldError id={`${secondId}-error`} error={fe.vapi_assistant_id?.[0]} />
          </div>
        )}
      </div>
      <div>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : "Save wiring"}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

/** Edit the economic fields of an existing CUSTOM plan (admin only). */
export function EditCustomPlanForm({
  tenantId,
  plan,
}: {
  tenantId: string;
  plan: {
    plan_name: string;
    monthly_call_allowance: number;
    included_agents: number;
    plan_price_gbp: number;
    extra_credit_price_gbp: number;
    validity_days: number;
  };
}) {
  const [state, formAction, pending] = useActionState(updateCustomPlan.bind(null, tenantId), initialState);
  const fe = state.fieldErrors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Notice state={state} okText="Custom plan updated. The new extra-credit price applies to the next top-up." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Plan name</label>
          <input name="plan_name" defaultValue={plan.plan_name} className={inputClass} />
          <FieldError id="plan_name-error" error={fe.plan_name?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Number of calls (per period)</label>
          <input name="monthly_call_allowance" type="number" min="0" defaultValue={plan.monthly_call_allowance} className={inputClass} />
          <FieldError id="monthly_call_allowance-error" error={fe.monthly_call_allowance?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Number of agents</label>
          <input name="included_agents" type="number" min="0" defaultValue={plan.included_agents} className={inputClass} />
          <FieldError id="included_agents-error" error={fe.included_agents?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Plan / pack price (£)</label>
          <input name="plan_price_gbp" type="number" step="0.01" min="0" defaultValue={plan.plan_price_gbp} className={inputClass} />
          <FieldError id="plan_price_gbp-error" error={fe.plan_price_gbp?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Per-call extra credit (£, overage)</label>
          <input name="extra_credit_price_gbp" type="number" step="0.01" min="0" defaultValue={plan.extra_credit_price_gbp} className={inputClass} />
          <FieldError id="extra_credit_price_gbp-error" error={fe.extra_credit_price_gbp?.[0]} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Pack validity (days)</label>
          <input name="validity_days" type="number" min="1" defaultValue={plan.validity_days} className={inputClass} />
          <FieldError id="validity_days-error" error={fe.validity_days?.[0]} />
        </div>
      </div>
      <div>
        <button type="submit" disabled={pending} className={primaryBtn}>
          {pending ? "Saving…" : "Save custom plan"}
        </button>
      </div>
    </form>
  );
}
