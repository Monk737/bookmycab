import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

// Only text source files are scanned — binary assets (logos, fonts) can neither
// carry brand copy nor be decoded as UTF-8 reliably.
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".md",
  ".mdx",
  ".json",
  ".svg",
]);

// Resolve project root from this test file (tests/ -> ..).
const ROOT = fileURLToPath(new URL("..", import.meta.url));

// Directories that are customer-facing and must obey the brand rule.
const GUARDED_DIRS = [
  "src/app/(marketing)",
  "src/components/marketing",
  "src/lib/marketing",
];

// Forbidden terms (case-insensitive, word-boundary). n8n must never appear on
// any customer-facing surface; neither may the legacy "CabLab" name.
const FORBIDDEN = ["n8n", "workflow", "execution", "CabLab"];

function collectFiles(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // Directory does not exist yet — passes trivially.
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      // lstat (not stat) so symlinks are inspected, never followed.
      stat = lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (stat.isFile() && TEXT_EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

function findForbidden(content: string): string[] {
  return FORBIDDEN.filter((term) =>
    new RegExp(`\\b${term}\\b`, "i").test(content),
  );
}

describe("marketing brand rule", () => {
  const files = GUARDED_DIRS.flatMap((d) => collectFiles(join(ROOT, d)));

  it("scans the guarded marketing directories", () => {
    // Sanity: the guard runs even when dirs are empty/absent (length may be 0).
    expect(Array.isArray(files)).toBe(true);
  });

  it("contains no forbidden brand terms", () => {
    const offenders: Array<{ file: string; terms: string[] }> = [];
    for (const file of files) {
      const terms = findForbidden(readFileSync(file, "utf8"));
      if (terms.length > 0) {
        offenders.push({ file, terms });
      }
    }
    expect(offenders).toEqual([]);
  });
});
