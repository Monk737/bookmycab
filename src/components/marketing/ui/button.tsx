import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-[0.04em] " +
  "cursor-pointer brut-focus select-none " +
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const VARIANTS: Record<Variant, string> = {
  // Yellow brand fill, the booking / primary action.
  primary: "brut-press border-[3px] border-ink bg-brut-yellow text-ink shadow-brut",
  // Paper outline block.
  secondary: "brut-press border-[3px] border-ink bg-paper text-ink shadow-brut",
  // Low-key inline action, no frame/shadow, underline on hover.
  ghost: "text-ink underline-offset-4 hover:underline",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-5 text-sm",
  lg: "h-12 px-7 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

type ButtonProps = ButtonAsButton | ButtonAsLink;

/** Polymorphic button, renders an `<a>` when `href` is provided, else a `<button>`. */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;

  if ("href" in props && props.href !== undefined) {
    const { href, ...rest } = props as ButtonAsLink;
    // Internal routes use next/link (client-side nav + prefetch); external or
    // anchor hrefs fall back to a plain <a>.
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={classes} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }

  const { ...rest } = props as ButtonAsButton;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
