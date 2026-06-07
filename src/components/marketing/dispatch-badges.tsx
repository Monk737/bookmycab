import Image from "next/image";
import { Badge } from "@/components/marketing/ui/badge";

type DispatchSystem = {
  name: string;
  src: string;
  status: "available" | "coming-soon";
};

// AutoCab, iCabbi and Cordic are all supported dispatch integrations.
// Dark wordmark logos on transparent, so each sits on a light paper tile.
const DISPATCH_SYSTEMS: DispatchSystem[] = [
  { name: "AutoCab", src: "/dispatch/autocab.png", status: "available" },
  { name: "iCabbi", src: "/dispatch/icabbi.png", status: "available" },
  { name: "Cordic", src: "/dispatch/cordic.png", status: "available" },
];

/** Presentational row of supported dispatch integrations with status badges. */
export function DispatchBadges() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {DISPATCH_SYSTEMS.map((system) => (
        <li
          key={system.name}
          className="brut-hover-lift flex flex-col items-center justify-center gap-5 border-[3px] border-ink bg-paper px-5 py-8 shadow-brut-sm"
        >
          <Image
            src={system.src}
            alt={system.name}
            width={767}
            height={325}
            className="h-16 w-auto max-w-full object-contain"
          />
          {system.status === "available" ? (
            <Badge tone="lime">Supported</Badge>
          ) : (
            <Badge tone="paper">Coming soon</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
