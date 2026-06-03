/**
 * Builds a `wa.me` deep link from an international phone number and an optional
 * prefilled message. Returns null when no usable number is configured, so the
 * demo CTA can render nothing until a number is provisioned (Q12).
 */
export function whatsAppLink(number: string | undefined, message?: string): string | null {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
