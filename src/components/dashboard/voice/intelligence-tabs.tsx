import Link from "next/link";

const TABS = [
  { key: "bookings", label: "Bookings", href: "/dashboard/voice/intelligence" },
  { key: "quality", label: "Agent quality", href: "/dashboard/voice/quality" },
] as const;

/** Segmented nav shared by the two intelligence surfaces. Preserves the selected
 *  billing cycle across the tab switch. */
export function IntelligenceTabs({ active, cycleKey }: { active: "bookings" | "quality"; cycleKey?: string }) {
  const suffix = cycleKey ? `?cycle=${cycleKey}` : "";
  return (
    <nav className="inline-flex border-[3px] border-ink shadow-brut" aria-label="Intelligence views">
      {TABS.map((t, i) => (
        <Link
          key={t.key}
          href={`${t.href}${suffix}`}
          aria-current={active === t.key ? "page" : undefined}
          className={`brut-focus inline-flex h-10 items-center px-4 text-xs font-bold uppercase tracking-[0.06em] ${
            i > 0 ? "border-l-[3px] border-ink" : ""
          } ${active === t.key ? "bg-ink text-paper" : "bg-paper text-ink hover:bg-brut-yellow"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
