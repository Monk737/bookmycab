// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ChatBriefingArchive } from "@/components/dashboard/chat/briefing-archive";
import type { ChatBriefing, ChatBriefingMetrics } from "@/lib/chat/briefing";

afterEach(cleanup);

const metrics = (over: Partial<ChatBriefingMetrics> = {}): ChatBriefingMetrics => ({
  weekStart: "2026-09-01", weekEnd: "2026-09-07",
  totalConversations: 42, prevTotalConversations: 30, bookedPct: 38, prevBookedPct: 31,
  bookings: 16, quoted: 9, cancelled: 2, modified: 1, failed: 0, unresolved: 3, voiceNotePct: 12,
  busiest: { label: "Fri 5–6pm", count: 7 }, topRoute: null, revenueGbp: 812, avgFareGbp: 51,
  ...over,
});

const briefing = (start: string, end: string, headline: string, over: Partial<ChatBriefing> = {}): ChatBriefing => ({
  headline,
  narrative: `${headline} narrative. `.repeat(20).trim(),
  recommendation: `Fix for ${headline}`,
  metrics: metrics(),
  periodStart: start, periodEnd: end, createdAt: `${end}T08:00:00Z`, model: null,
  ...over,
});

const WEEKS = [
  briefing("2026-09-01", "2026-09-07", "Airport runs carried the week"),
  briefing("2026-08-25", "2026-08-31", "Quotes stalled at the name step"),
];

describe("ChatBriefingArchive", () => {
  it("gives every earlier week a Read full briefing button", () => {
    render(<ChatBriefingArchive briefings={WEEKS} />);
    expect(screen.getAllByRole("button", { name: /read full briefing/i })).toHaveLength(2);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the chosen week's complete briefing in a modal", () => {
    render(<ChatBriefingArchive briefings={WEEKS} />);
    fireEvent.click(screen.getAllByRole("button", { name: /read full briefing/i })[1]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("Quotes stalled at the name step");
    expect(dialog).toHaveTextContent("Fix for Quotes stalled at the name step");
    expect(dialog).toHaveTextContent("Recommended this week");
    expect(dialog).not.toHaveTextContent("Fix for Airport runs carried the week");
    expect(screen.getByRole("button", { name: /close briefing/i })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape and returns focus to the button that opened it", () => {
    render(<ChatBriefingArchive briefings={WEEKS} />);
    const trigger = screen.getAllByRole("button", { name: /read full briefing/i })[0];
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes from the close button", () => {
    render(<ChatBriefingArchive briefings={WEEKS} />);
    fireEvent.click(screen.getAllByRole("button", { name: /read full briefing/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /close briefing/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
