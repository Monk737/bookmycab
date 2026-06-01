import { Badge } from "@/components/marketing/ui/badge";

type DispatchSystem = {
  name: string;
  status: "available" | "coming-soon";
};

// AutoCab is live (v1, primary). iCabbi + Cordic land in v1.2 (PRD §18.2).
const DISPATCH_SYSTEMS: DispatchSystem[] = [
  { name: "AutoCab", status: "available" },
  { name: "iCabbi", status: "coming-soon" },
  { name: "Cordic", status: "coming-soon" },
];

/** Presentational row of supported dispatch integrations with status badges. */
export function DispatchBadges() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {DISPATCH_SYSTEMS.map((system) => (
        <li
          key={system.name}
          className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-paper px-5 py-4"
        >
          <span className="font-display text-xl font-semibold text-ink">
            {system.name}
          </span>
          {system.status === "available" ? (
            <Badge className="border-ink bg-accent text-accent-ink">
              Supported
            </Badge>
          ) : (
            <Badge>Coming soon</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
