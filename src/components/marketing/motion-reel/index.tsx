"use client";

import { useEffect, useState } from "react";
import styles from "./motion-reel.module.css";

/**
 * "On the street" reel. Crossfades through four illustrated London panels that
 * tell the core story: a dead signal and a stuck booking app, then a BookMyCab
 * hoarding QR, a WhatsApp voice booking, and a black cab at the kerb. The panels
 * carry their own captions; a slow Ken Burns push adds life.
 *
 * prefers-reduced-motion: freezes on the resolved frame with no crossfade.
 */

const FRAMES = [
  {
    src: "/motion/scene-1.jpg",
    label: "No network. The app won't connect.",
  },
  {
    src: "/motion/scene-3.jpg",
    label: "Scan the hoarding. Book on WhatsApp by voice.",
  },
  {
    src: "/motion/scene-2.jpg",
    label: "Booked in seconds. Cab on the way.",
  },
  {
    src: "/motion/scene-4.jpg",
    label: "Cab's here. No app, no data, no wait.",
  },
] as const;

const HOLD_MS = 3800;
const REEL_LABEL =
  "From no signal to a booked cab: a Londoner scans a BookMyCab hoarding, books on WhatsApp by voice note, and a black cab arrives.";

export function MotionReel() {
  const [i, setI] = useState(0);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % FRAMES.length), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [i, reduced]);

  const active = reduced ? FRAMES.length - 1 : i;

  return (
    <figure className="m-0">
      <div className={styles.stage} role="img" aria-label={REEL_LABEL}>
        {FRAMES.map((f, k) => {
          const isActive = k === active;
          // Under reduced motion, render only the resolved frame — no stack, no
          // crossfade, nothing to animate.
          if (reduced && !isActive) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element -- crossfade stack; fixed pre-optimized assets
            <img
              key={f.src}
              src={f.src}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading={k === 0 ? "eager" : "lazy"}
              className={`${styles.frame} ${isActive ? styles.on : ""} ${
                isActive && !reduced ? styles.kb : ""
              }`}
            />
          );
        })}
        <div className={styles.progress} aria-hidden="true">
          {FRAMES.map((f, k) => (
            <span key={f.src} className={k === active ? styles.segOn : styles.seg} />
          ))}
        </div>
      </div>
      <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-[0.08em] text-gray-500">
        {FRAMES[active].label}
      </figcaption>
    </figure>
  );
}
