import "server-only";
import { env } from "@/env";

/**
 * Minimal Resend transactional-email sender.
 *
 * No-op-safe: when `RESEND_API_KEY` is absent (local/dev/test) it logs and
 * returns false instead of throwing, so a billing webhook never 500s purely
 * because email is unconfigured. Returns true only on a 2xx from Resend.
 *
 * `fetchImpl` is injectable for tests.
 */
export async function sendEmail(
  args: { to: string | string[]; subject: string; html: string; text: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.warn("sendEmail: RESEND_API_KEY missing, skipping", { subject: args.subject });
    return false;
  }
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: Array.isArray(args.to) ? args.to : [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });
    if (!res.ok) {
      console.error("sendEmail: Resend returned non-2xx", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendEmail threw", err);
    return false;
  }
}
