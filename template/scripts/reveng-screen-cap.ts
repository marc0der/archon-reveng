#!/usr/bin/env bun
/**
 * reveng SCREEN-CAP — `until_bash` stop condition for the
 * `screen-reconstruction` loop (spec §7.2).
 *
 * The loop body (the `screen-reconstruction` command) converts ONE screenshot
 * per iteration into `output/html/<name>.html` (fresh context each time). This
 * script is the authoritative loop terminator: it answers "is there any work
 * left?" purely from the filesystem.
 *
 * Exit-code contract (mirrors ralph's `until_bash` cap scripts — spec §2):
 *   - exit 0  → DONE: stop the loop (every screenshot has its HTML).
 *   - exit 1  → CONTINUE: at least one screenshot still lacks its HTML.
 *
 * Behaviour (argument-free, cwd-relative — resolves dirs from the run working
 * directory, sidestepping the `bun run` `--`-separator gotcha):
 *   1. Enumerate top-level files in `screenshots/` with a recognised image
 *      extension (png/jpg/jpeg/gif/bmp/webp), matched case-insensitively — the
 *      same set the precondition accepts.
 *   2. For each, a match is `output/html/<name>.html` where `<name>` is the
 *      screenshot's basename without its extension.
 *   3. Empty/absent `screenshots/` → DONE (vacuously true, exit 0).
 *
 * Sorted-order processing is the command prompt's responsibility, not this
 * script's — here we only count what remains.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
]);

/** Top-level image files in `screenshots/` (empty when the dir is absent). */
function screenshots(): string[] {
  if (!existsSync("screenshots")) return [];
  let entries: string[];
  try {
    entries = readdirSync("screenshots");
  } catch {
    return [];
  }
  return entries.filter((name) => {
    if (!IMAGE_EXTENSIONS.has(extname(name).toLowerCase())) return false;
    try {
      return statSync(join("screenshots", name)).isFile();
    } catch {
      return false;
    }
  });
}

/** Screenshots whose `output/html/<name>.html` does not yet exist. */
const pending = screenshots().filter((name) => {
  const stem = basename(name, extname(name));
  return !existsSync(join("output", "html", `${stem}.html`));
});

if (pending.length > 0) {
  console.error(
    `reveng-screen-cap: ${pending.length} screenshot(s) awaiting HTML:`,
  );
  for (const name of pending.sort()) console.error(`  - ${name}`);
  process.exit(1);
}

console.log("reveng-screen-cap: all screenshots reconstructed");
process.exit(0);
