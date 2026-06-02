import "server-only";

/**
 * Forwards the raw inbound payload to the engine webhook URL WITHOUT awaiting the
 * engine's processing — the gateway must return 200 in p95 ≤300ms (PRD §11). We
 * start the request and attach a catch so a slow/failed engine never rejects the
 * caller. Returns immediately.
 */
export function fireAndForgetForward(
  engineWebhookUrl: string,
  contentType: string,
  rawBody: string,
): void {
  // Intentionally not awaited.
  void fetch(engineWebhookUrl, {
    method: "POST",
    headers: { "content-type": contentType },
    body: rawBody,
  }).catch((err) => {
    // Do NOT log engineWebhookUrl — it is the internal engine host and must not
    // leak to log drains.
    console.error("engine forward failed", { err: String(err) });
  });
}
