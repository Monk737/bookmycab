import type { ReactNode } from "react";

type Tone = "yellow" | "lime" | "blue" | "pink" | "cyan" | "violet" | "paper";

const TONES: Record<Tone, string> = {
  yellow: "bg-brut-yellow",
  lime: "bg-brut-lime",
  blue: "bg-brut-blue text-paper",
  pink: "bg-brut-pink",
  cyan: "bg-brut-cyan",
  violet: "bg-brut-violet",
  paper: "bg-paper",
};

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

/** Rectangular ink-framed flat chip, the brutalist eyebrow / metadata label. */
export function Badge({ children, tone = "yellow", className = "" }: BadgeProps) {
  return (
    <span
      className={
        "inline-flex items-center border-2 border-ink px-2.5 py-1 " +
        "text-xs font-bold uppercase tracking-[0.08em] text-ink " +
        `${TONES[tone]} ${className}`
      }
    >
      {children}
    </span>
  );
}
