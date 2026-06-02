import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/dashboard/csv";

describe("toCsv", () => {
  it("joins headers + rows with CRLF and trailing newline", () => {
    const out = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(out).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });
  it("quotes fields containing comma, quote, or newline (RFC 4180)", () => {
    const out = toCsv(["x"], [['a,b'], ['he said "hi"'], ["line\nbreak"]]);
    expect(out).toContain('"a,b"');
    expect(out).toContain('"he said ""hi"""');
    expect(out).toContain('"line\nbreak"');
  });
});
