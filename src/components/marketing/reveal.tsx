"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { ElementType, ReactNode } from "react";

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type RevealProps = {
  children: ReactNode;
  /** Element to render (default div). Use "ul"/"ol" for lists. */
  as?: ElementType;
  className?: string;
};

/**
 * Scroll-reveal wrapper for genuine lists/grids. Its direct children rise in,
 * staggered, the first time the group scrolls into view.
 *
 * Robustness: the server renders the children fully visible. Only when JS runs
 * AND motion is allowed does it (before first paint, via useLayoutEffect) add
 * `.reveal` to hide them, then `.is-in` on intersection to play them in. No-JS,
 * reduced-motion and headless renderers therefore always show the finished state.
 */
export function Reveal({ children, as, className = "" }: RevealProps) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);

  useIso(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = ref.current;
    if (reduce || !node) return;
    // Hide before paint, so there's no flash of the visible state.
    node.classList.add("reveal");
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = ref.current;
    if (reduce || !node) return;

    const reveal = () => node.classList.add("is-in");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            cleanup();
            break;
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    // Safety net: if the observer never fires (background tab, headless render,
    // odd layout), reveal anyway so content can never stay hidden.
    const fallback = window.setTimeout(reveal, 1400);

    function cleanup() {
      observer.disconnect();
      window.clearTimeout(fallback);
    }
    return cleanup;
  }, []);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
