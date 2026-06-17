import { describe, it, expect } from "vitest";
import { diffLines } from "@/lib/voice/prompt-diff";

describe("diffLines", () => {
  it("marks unchanged lines as same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("marks a changed line as remove then add", () => {
    expect(diffLines("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });

  it("handles pure insertions and deletions", () => {
    expect(diffLines("a", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
    ]);
    expect(diffLines("a\nb", "a")).toEqual([
      { type: "same", text: "a" },
      { type: "remove", text: "b" },
    ]);
  });
});
