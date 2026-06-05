export interface InvoiceBooking {
  id: string;
  passenger_name: string | null;
  fare: number | null;
  created_at: string;
}

export interface InvoiceLineItem {
  bookingId: string;
  description: string;
  date: string;
  amount: number;
}

export interface ComputedInvoice {
  lineItems: InvoiceLineItem[];
  subtotal: number;
  markup: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure: build invoice line items from bookings and apply a markup percentage.
 * One line per booking; null fares count as 0.
 */
export function computeInvoice(bookings: InvoiceBooking[], markupPct: number): ComputedInvoice {
  const lineItems: InvoiceLineItem[] = bookings.map((b) => ({
    bookingId: b.id,
    description: `Journey — ${b.passenger_name ?? "passenger"}`,
    date: b.created_at.slice(0, 10),
    amount: round2(b.fare ?? 0),
  }));
  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.amount, 0));
  const markup = round2(subtotal * (markupPct / 100));
  const total = round2(subtotal + markup);
  return { lineItems, subtotal, markup, total };
}
