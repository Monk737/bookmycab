import type { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  className?: string;
};

/** Small editorial eyebrow / label pill. */
export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full border border-gray-200 bg-gray-50 " +
        "px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-gray-600 " +
        className
      }
    >
      {children}
    </span>
  );
}
