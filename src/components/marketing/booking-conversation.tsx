"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animated WhatsApp-style booking conversation used as the homepage hero
 * centrepiece. It tells the whole product story in one glance: a customer
 * sends a voice note, the automation reads the intent, quotes a fare,
 * confirms the booking, and mirrors it into the firm's dispatch system.
 *
 * Accessibility / robustness:
 * - The default (no-JS, SSR, reduced-motion) state renders the FULL completed
 *   thread, so the content is never gated behind an animation that might not
 *   fire (hidden tabs, headless renderers, prefers-reduced-motion).
 * - With motion allowed, it starts empty and reveals one turn at a time when
 *   scrolled into view, playing through once.
 */

type Turn = { id: string; kind: "voice" | "text" | "summary" | "confirm" | "dispatch" };

// The conversation, in order. Bot turns ("in") get a brief typing indicator
// before they appear; customer turns ("out") appear directly.
const TURNS: Turn[] = [
  { id: "voice", kind: "voice" },
  { id: "summary", kind: "summary" },
  { id: "ok", kind: "text" },
  { id: "confirm", kind: "confirm" },
  { id: "dispatch", kind: "dispatch" },
];

const IS_BOT: Record<string, boolean> = {
  summary: true,
  confirm: true,
  dispatch: true,
};

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function BookingConversation() {
  // Start fully revealed so SSR / no-JS / reduced-motion all show the finished
  // thread. Motion-capable clients reset to 0 before first paint and play in.
  const [shown, setShown] = useState(TURNS.length);
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useIsoLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // leave the completed thread in place
    setShown(0);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = rootRef.current;
    if (reduce || !node) return;

    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const play = () => {
      clearTimers();
      let delay = 400;
      // Reveal turn 0 directly.
      timers.current.push(setTimeout(() => setShown(1), delay));

      for (let i = 1; i < TURNS.length; i += 1) {
        const turn = TURNS[i];
        if (IS_BOT[turn.id]) {
          // Show typing, then the bot bubble.
          delay += 700;
          const showTypingAt = delay;
          timers.current.push(setTimeout(() => setTyping(true), showTypingAt));
          delay += 950;
          const revealAt = delay;
          timers.current.push(
            setTimeout(() => {
              setTyping(false);
              setShown(i + 1);
            }, revealAt),
          );
        } else {
          delay += 1100;
          const revealAt = delay;
          timers.current.push(setTimeout(() => setShown(i + 1), revealAt));
        }
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            play();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      clearTimers();
    };
  }, []);

  const isShown = (index: number) => index < shown;

  return (
    <div
      ref={rootRef}
      className="relative mx-auto w-full max-w-sm"
      role="img"
      aria-label="A customer sends a voice note booking a cab from 14 Mill Road, Cambridge to Stansted Airport for 06:30 tomorrow. The automation transcribes it, quotes a £48 saloon fare, confirms the booking, and dispatches job number 4827 into AutoCab."
    >
      {/* Phone frame */}
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-[2rem] border border-gray-200 bg-gray-50 shadow-[0_30px_60px_-25px_rgba(10,10,10,0.35)]"
      >
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-gray-200 bg-paper px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display text-lg font-semibold text-accent-ink">
            P
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold text-ink">
              Premier Cars
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="status-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Automation online
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex min-h-[26rem] flex-col gap-3 px-4 py-5">
          {/* 1 — customer voice note */}
          {isShown(0) && (
            <Bubble side="out" turnId="voice">
              <VoiceNote />
            </Bubble>
          )}

          {/* 2 — automation booking summary */}
          {isShown(1) && (
            <Bubble side="in" turnId="summary">
              <p className="text-sm leading-relaxed text-ink">
                Got that, thanks. Here&apos;s your trip:
              </p>
              <dl className="mt-3 space-y-2 border-t border-gray-200 pt-3 text-sm">
                <Row label="Pickup" value="14 Mill Road, Cambridge" />
                <Row label="Drop-off" value="Stansted Airport (STN)" />
                <Row label="When" value="Tomorrow, 06:30" />
                <Row label="Vehicle" value="Saloon, 4 seats" />
              </dl>
              <div className="mt-3 flex items-baseline justify-between border-t border-gray-200 pt-3">
                <span className="text-sm text-gray-500">Estimated fare</span>
                <span className="font-display text-xl font-semibold tabular-nums text-ink">
                  £48.00
                </span>
              </div>
            </Bubble>
          )}

          {/* 3 — customer confirms */}
          {isShown(2) && (
            <Bubble side="out" turnId="ok">
              <p className="text-sm leading-relaxed text-ink">
                Perfect, book it please.
              </p>
            </Bubble>
          )}

          {/* 4 — booking confirmed */}
          {isShown(3) && (
            <Bubble side="in" turnId="confirm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
                  <CheckIcon />
                </span>
                <span className="font-display text-base font-semibold text-ink">
                  Booking confirmed
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                Reference{" "}
                <span className="font-medium tabular-nums text-ink">BMC-4827</span>. Your
                driver will be there at 06:30. Reply to change anything.
              </p>
            </Bubble>
          )}

          {/* typing indicator (transient, between turns) */}
          {typing && <TypingIndicator />}

          {/* 5 — dispatch mirror (system note, full width) */}
          {isShown(4) && (
            <div
              className="animate-msg-in mt-1 flex items-center gap-3 rounded-2xl border border-gray-200 bg-paper px-4 py-3"
              data-turn="dispatch"
            >
              <span className="status-pulse mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-accent" />
              <p className="text-xs leading-relaxed text-gray-600">
                Written into{" "}
                <span className="font-semibold text-ink">AutoCab</span> as job{" "}
                <span className="font-medium tabular-nums text-ink">#4827</span>. No
                double-entry, no copy-paste.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  turnId,
  children,
}: {
  side: "in" | "out";
  turnId: string;
  children: React.ReactNode;
}) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        data-turn={turnId}
        className={
          "animate-msg-in max-w-[85%] rounded-2xl px-4 py-3 " +
          (out
            ? "rounded-br-md bg-accent/90 text-accent-ink"
            : "rounded-bl-md border border-gray-200 bg-paper")
        }
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function VoiceNote() {
  // Static waveform — a believable voice-message affordance, not a real player.
  const bars = [8, 14, 20, 12, 22, 16, 9, 18, 24, 14, 10, 17, 21, 11, 7];
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-ink/10">
        <PlayIcon />
      </span>
      <div className="flex items-center gap-[3px]" aria-hidden="true">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full bg-accent-ink/50"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums text-accent-ink/70">0:06</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-hidden="true">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-gray-200 bg-paper px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-1.5 w-1.5 rounded-full bg-gray-400"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-accent-ink"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent-ink" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
