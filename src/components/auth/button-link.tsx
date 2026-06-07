import Link from "next/link";
import type { ComponentProps } from "react";

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className">;

/**
 * A Next.js Link styled as a full-width primary button.
 * Matches the visual style of SubmitButton so that error/expired states
 * can offer a navigation CTA with the same prominence as a form submit.
 */
export function ButtonLink({ children, ...props }: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className="brut-press brut-focus block w-full border-[3px] border-ink bg-brut-yellow px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-brut cursor-pointer"
    >
      {children}
    </Link>
  );
}
