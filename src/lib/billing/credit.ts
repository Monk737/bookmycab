/**
 * AI Voice credit top-up pricing. App-managed prepaid model (see B1):
 * 1 credit = 1 call = £0.90. Stripe handles the purchase only; the webhook
 * grants the credits in metadata to credit_ledger.
 */
export const CREDIT_UNIT_GBP = 0.9;
export const MIN_TOPUP_GBP = 9;

export interface CreditPack {
  id: string;
  gbp: number;
  credits: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_10", gbp: 9, credits: 10 },
  { id: "pack_50", gbp: 45, credits: 50 },
  { id: "pack_100", gbp: 90, credits: 100 },
];

/** Whole credits a paid GBP amount buys (floor). */
export function creditsForGbp(gbp: number): number {
  return Math.floor(gbp / CREDIT_UNIT_GBP);
}

export type TopupResult =
  | { ok: true; credits: number }
  | { ok: false; error: string };

/** Validate a custom top-up amount (finite, >= MIN_TOPUP_GBP). */
export function validateCustomTopup(gbp: number): TopupResult {
  if (!Number.isFinite(gbp) || gbp < MIN_TOPUP_GBP) {
    return { ok: false, error: `Minimum top-up is £${MIN_TOPUP_GBP}.` };
  }
  return { ok: true, credits: creditsForGbp(gbp) };
}

export type ResolvedTopup =
  | { ok: true; gbp: number; credits: number }
  | { ok: false; error: string };

/** Resolve a pack id OR a custom amount into a chargeable { gbp, credits }. */
export function resolveTopupAmount(input: { packId?: string; customGbp?: number }): ResolvedTopup {
  if (input.packId) {
    const pack = CREDIT_PACKS.find((p) => p.id === input.packId);
    if (!pack) return { ok: false, error: "Unknown credit pack." };
    return { ok: true, gbp: pack.gbp, credits: pack.credits };
  }
  if (typeof input.customGbp === "number") {
    const v = validateCustomTopup(input.customGbp);
    if (!v.ok) return v;
    return { ok: true, gbp: input.customGbp, credits: v.credits };
  }
  return { ok: false, error: "Pick a pack or enter an amount." };
}
