#!/usr/bin/env bun
/**
 * reveng PRECONDITION — `script` node guarding the workflow entry.
 *
 * The first node in `.archon/workflows/reveng.yaml`. Asserts that all three
 * required workspace inputs are populated before any analysis phase runs, so
 * the run fails fast with a clear message rather than producing empty
 * analyses downstream (spec §7.1).
 *
 * Behaviour (a pure function of the filesystem; argument-free, cwd-relative —
 * resolves the input dirs from the run working directory per spec §2 engine
 * facts, avoiding the `bun run` `--`-separator gotcha):
 *   1. `screenshots/` — must contain ≥1 file with a recognised image
 *      extension (png/jpg/jpeg/gif/bmp/webp), matched case-insensitively.
 *   2. `transcripts/` — must contain ≥1 `*.txt` file.
 *   3. `src/` — must contain ≥1 file, searched recursively.
 *   4. Exit 0 when all three are populated; otherwise print to stderr exactly
 *      which input(s) are missing (one diagnostic per offender) and exit 1.
 *
 * Invoked from the workflow YAML as a `script` node (`runtime: bun`); no args,
 * no stdin. A non-zero exit fails the run (spec §2 — a `script` node fails the
 * run on non-zero exit).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
]);

/** True when `dir` exists and holds ≥1 entry satisfying `accept`. */
function hasMatchingFile(
  dir: string,
  accept: (name: string) => boolean,
  recursive = false,
): boolean {
  if (!existsSync(dir)) return false;
  let entries: string[];
  try {
    entries = readdirSync(dir, { recursive });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (!accept(entry)) continue;
    try {
      if (statSync(join(dir, entry)).isFile()) return true;
    } catch {
      // Unreadable entry — ignore and keep scanning.
    }
  }
  return false;
}

const missing: string[] = [];

if (!hasMatchingFile("screenshots", (name) =>
  IMAGE_EXTENSIONS.has(extname(name).toLowerCase()),
)) {
  missing.push(
    "screenshots/ — needs ≥1 image (png/jpg/jpeg/gif/bmp/webp)",
  );
}

if (!hasMatchingFile("transcripts", (name) =>
  extname(name).toLowerCase() === ".txt",
)) {
  missing.push("transcripts/ — needs ≥1 .txt transcript");
}

if (!hasMatchingFile("src", () => true, true)) {
  missing.push("src/ — needs ≥1 source file (searched recursively)");
}

if (missing.length > 0) {
  console.error("reveng-precondition: missing required input(s):");
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

console.log("reveng-precondition: all required inputs present");
process.exit(0);
