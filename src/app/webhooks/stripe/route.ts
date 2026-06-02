import "server-only";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { env } from "@/env";
import { getStripe } from "@/lib/billing/stripe";
import { claimOnce } from "@/lib/redis/idempotency";
import { handleStripeEvent } from "@/lib/billing/handle-event";
import { buildBillingDeps } from "@/lib/billing/webhook-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_DEDUPE_TTL_SEC = 24 * 60 * 60;

export async function POST(req: Request): Promise<Response> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("/webhooks/stripe: STRIPE_WEBHOOK_SECRET missing");
    return new NextResponse("Webhook not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("/webhooks/stripe: signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const fresh = await claimOnce(`stripe:evt:${event.id}`, EVENT_DEDUPE_TTL_SEC);
  if (!fresh) return NextResponse.json({ received: true, deduped: true });

  try {
    const result = await handleStripeEvent(event, buildBillingDeps());
    return NextResponse.json({ received: true, action: result.action });
  } catch (err) {
    console.error("/webhooks/stripe: handler failed", err);
    return new NextResponse("Handler error", { status: 500 });
  }
}
