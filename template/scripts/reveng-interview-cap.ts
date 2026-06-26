#!/usr/bin/env bun
/**
 * reveng INTERVIEW-CAP — `until_bash` stop condition for the
 * `interview-curation` loop (spec §7.3).
 *
 * The loop body (the `interview-curation` command) curates ONE transcript per
 * iteration into `output/transcripts/<name>_curated.txt` (fresh context each
 * time). This script is the authoritative loop terminator: it answers "is
 * there any work left?" purely from the filesystem. It is the transcript
 * counterpart to `reveng-screen-cap.ts` (§7.2) — same exit-code contract.
 *
 * Exit-code contract (mirrors ralph's `until_bash` cap scripts — spec §2):
 *   - exit 0  → DONE: stop the loop (every transcript has its curated copy).
 *   - exit 1  → CONTINUE: at least one transcript still lacks its curated copy.
 *
 * Behaviour (argument-free, cwd-relative — resolves dirs from the run working
 * directory, sidestepping the `bun run` `--`-separator gotcha):
 *   1. Enumerate top-level `*.txt` files in `transcripts/`, EXCLUDING any
 *      `*_curated.txt` (a curated artefact is never itself an input to curate).
 *   2. For each, a match is `output/transcripts/<name>_curated.txt` where
 *      `<name>` is the transcript's basename without its `.txt` extension.
 *   3. Empty/absent `transcripts/` → DONE (vacuously true, exit 0).
 *
 * Sorted-order processing is the command prompt's responsibility, not this
 * script's — here we only count what remains.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

/** Top-level source `*.txt` transcripts (curated artefacts excluded). */
function transcripts(): string[] {
  if (!existsSync("transcripts")) return [];
  let entries: string[];
  try {
    entries = readdirSync("transcripts");
  } catch {
    return [];
  }
  return entries.filter((name) => {
    if (extname(name).toLowerCase() !== ".txt") return false;
    if (name.toLowerCase().endsWith("_curated.txt")) return false;
    try {
      return statSync(join("transcripts", name)).isFile();
    } catch {
      return false;
    }
  });
}

/** Transcripts whose `output/transcripts/<name>_curated.txt` is missing. */
const pending = transcripts().filter((name) => {
  const stem = basename(name, extname(name));
  return !existsSync(
    join("output", "transcripts", `${stem}_curated.txt`),
  );
});

if (pending.length > 0) {
  console.error(
    `reveng-interview-cap: ${pending.length} transcript(s) awaiting curation:`,
  );
  for (const name of pending.sort()) console.error(`  - ${name}`);
  process.exit(1);
}

console.log("reveng-interview-cap: all transcripts curated");
process.exit(0);
