import { Panel } from "@/components/dashboard/ui";
import type { VoiceBookingRow } from "@/lib/voice/bookings";

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-brut-lime",
  modified: "bg-brut-cyan",
  cancelled: "bg-brut-pink",
  completed: "bg-brut-lime",
  no_show: "bg-gray-100",
};

/** pickup_time is UK local wall-clock ISO without timezone, e.g. 2026-06-15T06:00. */
function fmtPickup(s: string | null): string {
  if (!s) return "ASAP";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return s;
  const [, y, mo, d, hh, mm] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm));
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Live booking ledger mirrored from Autocab via the AI Voice engine. */
export function BookingsPanel({ rows }: { rows: VoiceBookingRow[] }) {
  return (
    <Panel title="Bookings">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No bookings yet. When your AI Voice agent confirms, modifies or cancels a booking, it shows up here.
        </p>
      ) : (
        <ul className="divide-y-2 divide-gray-100">
          {rows.map((b) => (
            <li key={b.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-mono text-xs font-bold tabular-nums text-ink">#{b.booking_ref}</span>
                <span
                  className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink ${
                    STATUS_STYLE[b.status] ?? "bg-gray-100"
                  }`}
                >
                  {b.status.replace("_", " ")}
                </span>
                <span className="font-mono text-xs tabular-nums text-gray-500">{fmtPickup(b.pickup_time)}</span>
                {b.fare ? <span className="font-mono text-xs font-bold tabular-nums text-ink">{b.fare}</span> : null}
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-gray-700">
                {b.pickup ?? "—"} <span className="text-gray-400">&rarr;</span> {b.destination ?? "—"}
                {b.passenger_name ? <span className="text-gray-500"> &middot; {b.passenger_name}</span> : null}
                {b.passengers != null ? <span className="text-gray-500"> &middot; {b.passengers} pax</span> : null}
                {b.bags != null ? <span className="text-gray-500"> &middot; {b.bags} bags</span> : null}
                {b.vehicle_type ? <span className="text-gray-500"> &middot; {b.vehicle_type}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
