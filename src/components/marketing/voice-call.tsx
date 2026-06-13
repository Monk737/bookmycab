"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animated AI-voice booking call. Reads as a live phone call, not a chat:
 * a call header with a running timer and a speaking waveform, then captioned
 * CALLER / AGENT turns, a spoken fare quote, and the job written to dispatch.
 *
 * Robustness mirrors BookingConversation: SSR / no-JS / reduced-motion render
 * the full finished transcript, so nothing is gated behind motion. With motion
 * allowed, it plays the call turn-by-turn once it scrolls into view, then loops.
 */

type Turn =
  | { who: "agent" | "caller"; line: string }
  | { kind: "quote"; pickup: string; dropoff: string; when: string; vehicle: string; fare: string }
  | { kind: "dispatch"; system: string; job: string };

const TURNS: Turn[] = [
  { who: "agent", line: "Premier Cabs, how can I help?" },
  { who: "caller", line: "I need a cab from 14 Mill Road to Stansted, half six tomorrow morning." },
  { who: "agent", line: "Of course. A saloon from 14 Mill Road out to Stansted Airport, picking up at 6:30." },
  {
    kind: "quote",
    pickup: "14 Mill Road, Cambridge",
    dropoff: "Stansted Airport (STN)",
    when: "Tomorrow, 06:30",
    vehicle: "Saloon, 4 seats",
    fare: "£48.00",
  },
  { who: "caller", line: "Perfect, go ahead and book it." },
  { who: "agent", line: "Booked. Your driver will be there at 6:30, reference BMC-4827. Anything else?" },
  { kind: "dispatch", system: "AutoCab", job: "#4827" },
];

// Roughly how long each turn "takes" on the call, for the running timer.
const TURN_SECONDS = [3, 6, 6, 3, 3, 6, 2];

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VoiceCall() {
  // Start fully revealed for SSR / no-JS / reduced-motion.
  const [shown, setShown] = useState(TURNS.length);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useIso(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShown(0);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = rootRef.current;
    if (reduce || !node) return;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const play = () => {
      clear();
      setShown(0);
      let delay = 500;
      timers.current.push(setTimeout(() => setShown(1), delay));
      for (let i = 1; i < TURNS.length; i += 1) {
        delay += 1150;
        timers.current.push(setTimeout(() => setShown(i + 1), delay));
      }
      delay += 3200; // hold the finished call, then replay
      timers.current.push(setTimeout(play, delay));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
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
      clear();
    };
  }, []);

  // Keep the latest caption in view inside the fixed window.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [shown]);

  const elapsed = TURN_SECONDS.slice(0, Math.min(shown, TURNS.length)).reduce((a, b) => a + b, 0);
  const live = shown < TURNS.length; // call still "in progress" while turns reveal

  return (
    <div
      ref={rootRef}
      className="relative mx-auto w-full max-w-md"
      role="img"
      aria-label="A live BookMyCab AI Voice Agent call: the agent answers, the caller asks for a saloon from 14 Mill Road to Stansted Airport at 6:30 tomorrow, the agent quotes £48 and confirms, and the job is written into AutoCab as #4827."
    >
      <div aria-hidden="true" className="overflow-hidden border-[3px] border-ink bg-canvas shadow-brut-xl">
        {/* Call header */}
        <div className="flex items-center gap-3 border-b-[3px] border-ink bg-ink px-5 py-4">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center border-2 border-paper bg-brut-yellow">
            <MicIcon />
            {live && <span className="call-ping absolute inset-0 border-2 border-brut-lime" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-logo text-sm leading-none tracking-tight text-paper">
                BookMyCab
                <span className="ml-1 inline-block h-2 w-2 border border-paper bg-brut-yellow" />
              </span>
              <span className="shrink-0 border-2 border-paper bg-brut-pink px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] leading-none text-ink">
                AI Voice Agent
              </span>
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-300">
              <span className="status-pulse inline-block h-1.5 w-1.5 bg-brut-lime ring-1 ring-paper" />
              {live ? "On call" : "Call ended"}
              <span className="font-mono tabular-nums text-gray-400">· {fmt(elapsed)}</span>
            </p>
          </div>
          <Waveform active={live} className="shrink-0" />
        </div>

        {/* Transcript — fixed window, captions scroll up. */}
        <div
          ref={bodyRef}
          className="flex h-[27rem] flex-col gap-3.5 overflow-y-auto px-5 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="mt-auto" />
          {TURNS.map((turn, i) => {
            if (i >= shown) return null;
            const key = i;
            const isLast = i === shown - 1;

            if ("kind" in turn && turn.kind === "quote") {
              return (
                <div key={key} className="animate-msg-in border-[3px] border-ink bg-paper p-4 shadow-brut-sm">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">Reading it back</p>
                  <dl className="mt-2.5 space-y-1.5 text-sm">
                    {[
                      ["Pickup", turn.pickup],
                      ["Drop-off", turn.dropoff],
                      ["When", turn.when],
                      ["Vehicle", turn.vehicle],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-4">
                        <dt className="shrink-0 text-gray-500">{k}</dt>
                        <dd className="text-right font-medium text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
                    <span className="text-sm font-semibold text-gray-600">Quoted fare</span>
                    <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-lg font-bold tabular-nums text-ink">
                      {turn.fare}
                    </span>
                  </div>
                </div>
              );
            }

            if ("kind" in turn && turn.kind === "dispatch") {
              return (
                <div key={key} className="animate-msg-in mt-0.5 flex items-center gap-3 border-[3px] border-ink bg-paper px-4 py-3 shadow-brut-sm">
                  <span className="status-pulse mt-0.5 inline-block h-2.5 w-2.5 shrink-0 border border-ink bg-brut-violet" />
                  <p className="text-xs leading-relaxed text-gray-600">
                    Written into <span className="font-bold text-ink">{turn.system}</span> as job{" "}
                    <span className="font-mono font-bold tabular-nums text-ink">{turn.job}</span>. No one touched a keyboard.
                  </p>
                </div>
              );
            }

            const t = turn as { who: "agent" | "caller"; line: string };
            const agent = t.who === "agent";
            return (
              <div key={key} className="animate-msg-in">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink ${
                      agent ? "bg-brut-yellow" : "bg-brut-cyan"
                    }`}
                  >
                    {agent ? "Agent" : "Caller"}
                  </span>
                  {isLast && live && <Waveform active small />}
                </div>
                <p className={`max-w-[92%] text-sm leading-relaxed ${agent ? "font-medium text-ink" : "text-gray-700"}`}>
                  {t.line}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Animated equaliser bars; static (mid height) under reduced motion. */
function Waveform({ active, small = false, className = "" }: { active: boolean; small?: boolean; className?: string }) {
  const count = small ? 5 : 7;
  const h = small ? 12 : 18;
  return (
    <span className={`flex items-end gap-[2px] ${className}`} aria-hidden="true" style={{ height: h }}>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={`${active ? "voice-bar" : ""} w-[3px] ${small ? "bg-ink" : "bg-brut-lime"}`}
          style={{ height: h, animationDelay: `${(i % 4) * 0.12}s` }}
        />
      ))}
    </span>
  );
}

/** Headset-agent avatar (matches VoiceMarkLine) rendered in ink on the chip. */
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#0a0a0a" strokeWidth="2.1" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      <path d="M5 12a7 7 0 0 1 14 0" />
      <path d="M4 12.5h2.2v4H4zM17.8 12.5H20v4h-2.2z" fill="#0a0a0a" />
      <circle cx="12" cy="10.5" r="3.2" />
      <path d="M6 21a6 6 0 0 1 12 0" />
      <path d="M18.5 16.5v.8a3 3 0 0 1-3 3H13" />
    </svg>
  );
}
