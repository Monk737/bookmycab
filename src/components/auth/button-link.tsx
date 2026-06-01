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
      className="block w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white text-center bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 cursor-pointer"
    >
      {children}
    </Link>
  );
}
