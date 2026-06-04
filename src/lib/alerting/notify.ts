import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";
import { sendEmail } from "@/lib/email/resend";
import { recordUsage } from "@/lib/entitlements/meter";

function svc() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export interface DispatchArgs {
  tenantId: string;
  channel: { id: string; type: string; destination: string };
  alertEventId: string;
  text: string;
}

/**
 * Deliver one alert through one channel: send, write a notification_log row,
 * and meter a notification on success. Never throws — returns the outcome.
 */
export async function dispatchNotification(
  args: DispatchArgs,
): Promise<{ status: "sent" | "failed" | "skipped" }> {
  const { tenantId, channel, alertEventId, text } = args;
  let ok = false;
  let error: string | null = null;

  try {
    if (channel.type === "email") {
      ok = await sendEmail({
        to: channel.destination,
        subject: "CabbyBot alert",
        html: `<p>${text}</p>`,
        text,
      });
      if (!ok) error = "email send returned false";
    } else {
      // slack/webhook: POST the text as JSON. Treat a 2xx as success.
      const res = await fetch(channel.destination, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      ok = res.ok;
      if (!ok) error = `webhook returned ${res.status}`;
    }
  } catch (e) {
    ok = false;
    error = e instanceof Error ? e.message : String(e);
  }

  const status: "sent" | "failed" = ok ? "sent" : "failed";
  await svc().from("notification_log").insert({
    tenant_id: tenantId,
    channel_id: channel.id,
    alert_event_id: alertEventId,
    type: channel.type,
    status,
    error,
  });

  if (ok) {
    await recordUsage({ tenantId, featureKey: "alerting", quantity: 1, unit: "notifications" });
  }
  return { status };
}
