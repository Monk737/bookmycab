import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import {
  verifyMetaSignature,
  verifyTelegramSecret,
  verifyWidgetSignature,
  verifyMetaSubscribe,
} from "@/lib/webhooks/signatures";
import { extractProviderMessageId, type Channel } from "@/lib/webhooks/message-id";
import { resolveAutomation } from "@/lib/webhooks/resolver";
import { loadChannelVerifySecret } from "@/lib/webhooks/resolver-loader";
import { claimOnce } from "@/lib/redis/idempotency";
import { fixedWindow } from "@/lib/redis/rate-limit";
import { fireAndForgetForward } from "@/lib/webhooks/forward";

export const runtime = "nodejs";

const CHANNELS: Channel[] = ["whatsapp", "telegram", "messenger", "instagram", "widget"];
const META_CHANNELS = new Set<Channel>(["whatsapp", "messenger", "instagram"]);

// Reject non-UUID automationIds on this unauthenticated path BEFORE any vault/
// Redis/DB work (code-review I-1): a malformed id would otherwise pollute Redis
// keyspace with unbounded probe traffic and force a failing DB uuid cast.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Fixed dummy key used only to equalize verify timing on the null-secret
// (unknown automation) branch — never a real credential.
const DUMMY_SECRET = "cabby-dummy-secret-not-a-real-key";

function isChannel(v: string): v is Channel {
  return (CHANNELS as string[]).includes(v);
}

/** Meta GET subscription handshake (WhatsApp/Messenger/Instagram only). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channel: string; automationId: string }> },
) {
  const { channel, automationId } = await params;
  if (!isChannel(channel) || !META_CHANNELS.has(channel)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!UUID_RE.test(automationId)) return new NextResponse("Not found", { status: 404 });
  const verifyToken = await loadChannelVerifySecret(automationId, "meta_verify_token");
  if (!verifyToken) return new NextResponse("Forbidden", { status: 403 });
  const q = Object.fromEntries(req.nextUrl.searchParams.entries());
  const challenge = verifyMetaSubscribe(q, verifyToken);
  return challenge
    ? new NextResponse(challenge, { status: 200 })
    : new NextResponse("Forbidden", { status: 403 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channel: string; automationId: string }> },
) {
  const { channel, automationId } = await params;
  if (!isChannel(channel)) return new NextResponse("Not found", { status: 404 });
  if (!UUID_RE.test(automationId)) return new NextResponse("Not found", { status: 404 });

  // Read the raw body ONCE — signature verification needs the exact bytes.
  const rawBody = await req.text();

  // 1) Verify the provider signature using the per-channel vault secret.
  const ok = await verifyInbound(channel, automationId, req, rawBody);
  if (!ok) return new NextResponse("Invalid signature", { status: 401 });

  // 2) Resolve the automation (cached). Unknown or non-live → swallow with 200
  //    so providers don't retry forever, but do not forward.
  const automation = await resolveAutomation(automationId);
  if (!automation || !automation.engineWebhookUrl) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (automation.status === "stopped" || automation.status === "error") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3) Rate-limit per automation+channel (fixed window).
  const rate = await fixedWindow(
    `rate:${automationId}:${channel}`,
    env.WEBHOOK_RATE_LIMIT_PER_MIN,
    60,
  );
  if (!rate.allowed) return new NextResponse("Too Many Requests", { status: 429 });

  // 4) Idempotency: skip if we've already seen this provider message id.
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    /* non-JSON bodies (rare) skip dedupe */
  }
  const msgId = body ? extractProviderMessageId(channel, body) : null;
  if (msgId) {
    const first = await claimOnce(`idem:${automationId}:${msgId}`, env.IDEMPOTENCY_TTL_SEC);
    if (!first) return NextResponse.json({ ok: true, deduped: true }, { status: 200 });
  }

  // 5) Fire-and-forget to the engine; return 200 immediately.
  fireAndForgetForward(
    automation.engineWebhookUrl,
    req.headers.get("content-type") ?? "application/json",
    rawBody,
  );
  return NextResponse.json({ ok: true }, { status: 200 });
}

async function verifyInbound(
  channel: Channel,
  automationId: string,
  req: NextRequest,
  rawBody: string,
): Promise<boolean> {
  if (META_CHANNELS.has(channel)) {
    const secret = await loadChannelVerifySecret(automationId, "meta_app_secret");
    if (!secret) {
      // No secret (unknown automation). Do a dummy constant-time HMAC verify so
      // this path costs roughly the same as a real bad-signature check, removing
      // the timing oracle that would otherwise reveal automation existence.
      verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), DUMMY_SECRET);
      return false;
    }
    return verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), secret);
  }
  if (channel === "telegram") {
    const secret = await loadChannelVerifySecret(automationId, "telegram_webhook_secret");
    if (!secret) {
      // Equalize unknown-automation vs bad-signature timing (see above).
      verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"), DUMMY_SECRET);
      return false;
    }
    return verifyTelegramSecret(req.headers.get("x-telegram-bot-api-secret-token"), secret);
  }
  // widget
  const secret = await loadChannelVerifySecret(automationId, "widget_signing_key");
  if (!secret) {
    // Equalize unknown-automation vs bad-signature timing (see above).
    verifyWidgetSignature(rawBody, req.headers.get("x-cabby-signature"), DUMMY_SECRET);
    return false;
  }
  return verifyWidgetSignature(rawBody, req.headers.get("x-cabby-signature"), secret);
}
