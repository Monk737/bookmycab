"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animated WhatsApp-style booking demo used as the homepage hero centrepiece.
 * It cycles through TWO scenarios so prospects see both booking modes:
 *   1. VOICE  — a customer sends a voice note; the bot transcribes and books it.
 *   2. TEXT   — a tap-to-book chatbot flow with quick-reply buttons, no voice.
 *
 * The two play one after the other on a loop, with a 3-second buffer between
 * them: voice plays through, holds 3s, the thread clears and the text flow
 * plays through, holds 3s, then back to voice, and so on.
 *
 * Accessibility / robustness:
 * - The default (no-JS, SSR, reduced-motion) state renders the FULL completed
 *   voice thread, so content is never gated behind an animation that may not
 *   fire (hidden tabs, headless renderers, prefers-reduced-motion).
 * - With motion allowed, it starts the loop once the demo scrolls into view.
 */

type Row = { label: string; value: string };

type Turn =
  | { kind: "voice" }
  | { kind: "out"; text: string }
  | { kind: "bot"; text: string }
  | { kind: "buttons"; text: string; buttons: string[]; tapped: string }
  | { kind: "summary"; rows: Row[]; fare: string; buttons: string[]; tapped: string }
  | { kind: "confirm"; reference: string; line: string }
  | { kind: "dispatch"; system: string; job: string };

const BOT_KINDS = new Set(["bot", "buttons", "summary", "confirm", "dispatch"]);

// Scenario 1 — voice note booking.
const VOICE: Turn[] = [
  { kind: "voice" },
  {
    kind: "summary",
    rows: [
      { label: "Pickup", value: "14 Mill Road, Cambridge" },
      { label: "Drop-off", value: "Stansted Airport (STN)" },
      { label: "When", value: "Tomorrow, 06:30" },
      { label: "Vehicle", value: "Saloon, 4 seats" },
    ],
    fare: "£48.00",
    buttons: ["Book it", "Change"],
    tapped: "Book it",
  },
  { kind: "out", text: "Book it" },
  {
    kind: "confirm",
    reference: "BMC-4827",
    line: "Your driver will be there at 06:30. Reply to change anything.",
  },
  { kind: "dispatch", system: "AutoCab", job: "#4827" },
];

// Scenario 2 — tap-to-book text chatbot, no voice note.
const TEXT: Turn[] = [
  {
    kind: "buttons",
    text: "Hi 👋 BookMyCab here. What do you need?",
    buttons: ["Book a cab", "Get a quote", "Manage booking"],
    tapped: "Book a cab",
  },
  { kind: "out", text: "Book a cab" },
  { kind: "bot", text: "Great. What's the pickup address?" },
  { kind: "out", text: "8 Regent Street, Cambridge" },
  {
    kind: "buttons",
    text: "And where to?",
    buttons: ["Town centre", "Train station", "Other address"],
    tapped: "Train station",
  },
  { kind: "out", text: "Cambridge Station" },
  {
    kind: "summary",
    rows: [
      { label: "Pickup", value: "8 Regent Street, Cambridge" },
      { label: "Drop-off", value: "Cambridge Station (CBG)" },
      { label: "When", value: "ASAP, ~5 min" },
      { label: "Vehicle", value: "Saloon, 4 seats" },
    ],
    fare: "£9.50",
    buttons: ["Confirm booking", "Change"],
    tapped: "Confirm booking",
  },
  { kind: "out", text: "Confirm booking" },
  {
    kind: "confirm",
    reference: "BMC-5193",
    line: "Your driver is 5 minutes away. Track them in this chat.",
  },
  { kind: "dispatch", system: "AutoCab", job: "#5193" },
];

const SCENARIOS = [VOICE, TEXT];
const BUFFER_MS = 3000;

// useLayoutEffect on the client, useEffect on the server (avoids the SSR warning).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function BookingConversation() {
  const [scenario, setScenario] = useState(0);
  // Start the voice thread fully revealed for SSR / no-JS / reduced-motion.
  const [shown, setShown] = useState(VOICE.length);
  const [typing, setTyping] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useIsoLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // leave the completed voice thread in place
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

    // Play one scenario turn by turn, then loop to the next after the buffer.
    const playScenario = (idx: number) => {
      clearTimers();
      setScenario(idx);
      setTyping(false);
      setShown(0);
      const turns = SCENARIOS[idx];
      let delay = 450;

      timers.current.push(setTimeout(() => setShown(1), delay));

      for (let i = 1; i < turns.length; i += 1) {
        if (BOT_KINDS.has(turns[i].kind)) {
          delay += 650;
          const showTypingAt = delay;
          timers.current.push(setTimeout(() => setTyping(true), showTypingAt));
          delay += 900;
          const revealAt = delay;
          timers.current.push(
            setTimeout(() => {
              setTyping(false);
              setShown(i + 1);
            }, revealAt),
          );
        } else {
          delay += 950;
          const revealAt = delay;
          timers.current.push(setTimeout(() => setShown(i + 1), revealAt));
        }
      }

      // Hold the finished thread, then shuffle to the other scenario.
      delay += BUFFER_MS;
      timers.current.push(
        setTimeout(() => playScenario((idx + 1) % SCENARIOS.length), delay),
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            playScenario(0);
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

  // Keep the latest message in view inside the fixed-height window, so new
  // turns scroll up and older ones slide out of frame, instead of the thread
  // growing taller and stretching the hero. Skipped under reduced motion,
  // where the full thread is rendered and left scrollable from the top.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown, typing, scenario]);

  const turns = SCENARIOS[scenario];
  const isShown = (i: number) => i < shown;
  const isAnswered = (i: number) => shown > i + 1; // the tap/reply after it has landed
  const modeLabel = scenario === 0 ? "Voice note" : "Tap to book";

  return (
    <div
      ref={rootRef}
      className="relative mx-auto w-full max-w-sm"
      role="img"
      aria-label="Two ways customers book: a voice note that the bot transcribes and books, and a tap-to-book text chat with quick-reply buttons. Both confirm the fare and write the job into the firm's dispatch system."
    >
      <div
        aria-hidden="true"
        className="overflow-hidden border-[3px] border-ink bg-canvas shadow-brut-xl"
      >
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b-[3px] border-ink bg-paper px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-brut-yellow font-logo text-sm leading-none text-ink">
            B
          </div>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 truncate font-logo text-sm leading-none tracking-tight text-ink">
              BookMyCab
              <span className="inline-block h-2 w-2 border border-ink bg-brut-yellow" />
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
              <span className="status-pulse inline-block h-1.5 w-1.5 bg-brut-lime ring-1 ring-ink" />
              Automation online
            </p>
          </div>
          {/* Which mode is playing now. */}
          <span className="shrink-0 border-2 border-ink bg-brut-cyan px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">
            {modeLabel}
          </span>
        </div>

        {/* Messages — fixed-height window; new turns scroll up out of view. */}
        <div
          ref={messagesRef}
          className="flex h-[27rem] flex-col gap-3 overflow-y-auto px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* Anchor the thread to the bottom so early, short threads still
              read naturally from the lower edge of the window. */}
          <div className="mt-auto" />

          {turns.map((turn, i) => {
            if (!isShown(i)) return null;
            const key = `${scenario}-${i}`;

            switch (turn.kind) {
              case "voice":
                return (
                  <Bubble key={key} side="out">
                    <VoiceNote />
                  </Bubble>
                );

              case "out":
                return (
                  <Bubble key={key} side="out">
                    <p className="text-sm leading-relaxed text-ink">{turn.text}</p>
                  </Bubble>
                );

              case "bot":
                return (
                  <Bubble key={key} side="in">
                    <p className="text-sm leading-relaxed text-ink">{turn.text}</p>
                  </Bubble>
                );

              case "buttons":
                return (
                  <Bubble key={key} side="in">
                    <p className="text-sm leading-relaxed text-ink">{turn.text}</p>
                    <QuickReplies
                      buttons={turn.buttons}
                      tapped={turn.tapped}
                      answered={isAnswered(i)}
                    />
                  </Bubble>
                );

              case "summary":
                return (
                  <Bubble key={key} side="in">
                    <p className="text-sm leading-relaxed text-ink">
                      Here&apos;s your trip:
                    </p>
                    <dl className="mt-3 space-y-2 border-t-2 border-ink pt-3 text-sm">
                      {turn.rows.map((r) => (
                        <RowItem key={r.label} label={r.label} value={r.value} />
                      ))}
                    </dl>
                    <div className="mt-3 flex items-baseline justify-between border-t-2 border-ink pt-3">
                      <span className="text-sm font-semibold text-gray-600">
                        Estimated fare
                      </span>
                      <span className="border-2 border-ink bg-brut-yellow px-2 py-0.5 font-mono text-lg font-bold tabular-nums text-ink">
                        {turn.fare}
                      </span>
                    </div>
                    <QuickReplies
                      buttons={turn.buttons}
                      tapped={turn.tapped}
                      answered={isAnswered(i)}
                    />
                  </Bubble>
                );

              case "confirm":
                return (
                  <Bubble key={key} side="in">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center border-2 border-ink bg-brut-lime">
                        <CheckIcon />
                      </span>
                      <span className="font-display text-base font-extrabold uppercase tracking-tight text-ink">
                        Booking confirmed
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">
                      Reference{" "}
                      <span className="font-mono font-bold tabular-nums text-ink">
                        {turn.reference}
                      </span>
                      . {turn.line}
                    </p>
                  </Bubble>
                );

              case "dispatch":
                return (
                  <div
                    key={key}
                    className="animate-msg-in mt-1 flex items-center gap-3 border-[3px] border-ink bg-paper px-4 py-3 shadow-brut-sm"
                  >
                    <span className="status-pulse mt-0.5 inline-block h-2.5 w-2.5 shrink-0 border border-ink bg-brut-violet" />
                    <p className="text-xs leading-relaxed text-gray-600">
                      Written into{" "}
                      <span className="font-bold text-ink">{turn.system}</span> as job{" "}
                      <span className="font-mono font-bold tabular-nums text-ink">
                        {turn.job}
                      </span>
                      . No double-entry, no copy-paste.
                    </p>
                  </div>
                );

              default:
                return null;
            }
          })}

          {typing && <TypingIndicator />}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
}: {
  side: "in" | "out";
  children: React.ReactNode;
}) {
  const out = side === "out";
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"}`}>
      <div
        className={
          "animate-msg-in max-w-[85%] border-2 border-ink px-4 py-3 shadow-brut-sm " +
          (out ? "bg-brut-yellow text-ink" : "bg-paper")
        }
      >
        {children}
      </div>
    </div>
  );
}

/** Interactive quick-reply chips. The tapped one lights up once answered. */
function QuickReplies({
  buttons,
  tapped,
  answered,
}: {
  buttons: string[];
  tapped: string;
  answered: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {buttons.map((b) => {
        const isTapped = b === tapped;
        const base =
          "border-2 border-ink px-2.5 py-1 text-xs font-bold uppercase tracking-[0.03em] transition-colors duration-200 ";
        const state = answered
          ? isTapped
            ? "bg-brut-yellow text-ink"
            : "bg-paper text-gray-400 opacity-50"
          : "bg-paper text-ink";
        return (
          <span key={b} className={base + state}>
            {b}
          </span>
        );
      })}
    </div>
  );
}

function RowItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function VoiceNote() {
  // Static waveform, a believable voice-message affordance, not a real player.
  const bars = [8, 14, 20, 12, 22, 16, 9, 18, 24, 14, 10, 17, 21, 11, 7];
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper">
        <PlayIcon />
      </span>
      <div className="flex items-center gap-[3px]" aria-hidden="true">
        {bars.map((h, i) => (
          <span key={i} className="w-[3px] bg-ink" style={{ height: `${h}px` }} />
        ))}
      </div>
      <span className="font-mono text-xs font-bold tabular-nums text-ink">0:06</span>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-hidden="true">
      <div className="flex items-center gap-1.5 border-2 border-ink bg-paper px-4 py-3.5 shadow-brut-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot h-1.5 w-1.5 bg-ink"
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
      className="text-ink"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-ink"
      aria-hidden="true"
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
