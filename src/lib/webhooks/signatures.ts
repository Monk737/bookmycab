import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string compare; false on length mismatch or null. */
function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Meta (WhatsApp/Messenger/Instagram): x-hub-signature-256: sha256=<hmac hex>. */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/** Telegram: x-telegram-bot-api-secret-token matches the registered secret. */
export function verifyTelegramSecret(
  header: string | null | undefined,
  expectedSecret: string,
): boolean {
  return safeEqual(header, expectedSecret);
}

/** Widget: x-cabby-signature: <hmac hex> over the raw body. */
export function verifyWidgetSignature(
  rawBody: string,
  header: string | null | undefined,
  signingKey: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", signingKey).update(rawBody).digest("hex");
  return safeEqual(header, expected);
}

/** Meta GET subscription handshake: echo hub.challenge iff token matches. */
export function verifyMetaSubscribe(
  query: Record<string, string | undefined>,
  expectedVerifyToken: string,
): string | null {
  if (
    query["hub.mode"] === "subscribe" &&
    safeEqual(query["hub.verify_token"], expectedVerifyToken)
  ) {
    return query["hub.challenge"] ?? null;
  }
  return null;
}
