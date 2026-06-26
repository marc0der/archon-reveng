#!/usr/bin/env bun
/**
 * reveng MERMAID-VALIDATE — the `mermaid-validate` script node (spec §7.4).
 *
 * Replaces reveng's `validate-mermaid` skill with a deterministic, non-blocking
 * check. It finds mermaid code blocks in the generated analyses + PRD and tries
 * to render each with `mmdc` (mermaid-cli, which drives a headless Chromium via
 * Puppeteer). It SURFACES broken diagrams for the human at the PRD gate; it does
 * NOT block the run and does NOT auto-fix.
 *
 * Exit contract: ALWAYS exit 0 — a tooling fault must never fail the run. The
 * outcome is a single status line on stdout, consumed by the `report` node:
 *   - `skipped: <reason>`        → mmdc absent OR the preflight probe failed
 *                                  (no real diagram is judged on a tooling fault).
 *   - `ok`                       → every mermaid block rendered (or none exist).
 *   - `invalid: <file#block>, …` → the probe succeeded but these blocks failed.
 *
 * Behaviour (argument-free, cwd-relative — resolves paths from the run working
 * directory, sidestepping the `bun run` `--`-separator gotcha):
 *   1. Extract fenced ```mermaid blocks from the three source files that exist:
 *      output/domain-analysis.md, output/interaction-analysis.md, output/PRD.md.
 *   2. No blocks → `ok` (nothing could be invalid); skip the probe entirely.
 *   3. `mmdc` not on PATH → `skipped` (the optional dependency is unavailable).
 *   4. Preflight self-probe: render a trivial known-good diagram. If it fails
 *      (Chromium missing/misconfigured) → `skipped` — never mark real diagrams
 *      `invalid` on a tooling fault.
 *   5. Probe OK → render every block; report `ok` or `invalid: <offenders>`.
 *
 * Sandbox/CI/root contexts: `mmdc` is invoked with a Puppeteer config enabling
 * `--no-sandbox` so Chromium can launch where the sandbox is unavailable (§7.4).
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Source files whose mermaid blocks are validated (spec §7.4). */
const SOURCES = [
  "output/domain-analysis.md",
  "output/interaction-analysis.md",
  "output/PRD.md",
];

interface Block {
  file: string;
  /** 1-based index of the mermaid block within its file. */
  index: number;
  content: string;
}

/**
 * Extract fenced ```mermaid blocks from markdown. Handles both backtick and
 * tilde fences of length ≥ 3, optional indentation, and a case-insensitive
 * `mermaid` info string; the closing fence must match the opener's char and be
 * at least as long.
 */
function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  let current: string[] | null = null;
  let fence = "";
  for (const line of content.split(/\r?\n/)) {
    if (current === null) {
      const open = line.match(/^\s*(`{3,}|~{3,})\s*mermaid\s*$/i);
      if (open) {
        current = [];
        fence = open[1];
      }
      continue;
    }
    const close = line.match(/^\s*(`{3,}|~{3,})\s*$/);
    if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
      blocks.push(current.join("\n"));
      current = null;
    } else {
      current.push(line);
    }
  }
  return blocks;
}

/** All mermaid blocks across the existing source files, in document order. */
function collectBlocks(): Block[] {
  const all: Block[] = [];
  for (const file of SOURCES) {
    if (!existsSync(file)) continue;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    extractMermaidBlocks(text).forEach((content, i) => {
      all.push({ file, index: i + 1, content });
    });
  }
  return all;
}

/** True when `mmdc` resolves on PATH (a spawn ENOENT means it does not). */
function mmdcPresent(): boolean {
  const probe = spawnSync("mmdc", ["--version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

/** Render `source` mermaid with `mmdc`; returns true on a clean render. */
function renders(source: string, work: string, puppeteer: string): boolean {
  const input = join(work, "diagram.mmd");
  const output = join(work, "diagram.svg");
  writeFileSync(input, source);
  const result = spawnSync(
    "mmdc",
    ["--puppeteerConfigFile", puppeteer, "--input", input, "--output", output],
    { stdio: "ignore" },
  );
  return !result.error && result.status === 0 && existsSync(output);
}

function emit(status: string): never {
  console.log(status);
  process.exit(0);
}

const blocks = collectBlocks();
if (blocks.length === 0) emit("ok");

if (!mmdcPresent()) emit("skipped: mmdc not found on PATH");

const work = mkdtempSync(join(tmpdir(), "reveng-mermaid-"));
let status: string;
try {
  // `--no-sandbox` lets headless Chromium launch in sandboxed/CI/root contexts.
  const puppeteer = join(work, "puppeteer.json");
  writeFileSync(
    puppeteer,
    JSON.stringify({ args: ["--no-sandbox", "--disable-setuid-sandbox"] }),
  );

  // Preflight self-probe: a trivial known-good diagram must render, else the
  // fault is the toolchain (Chromium), not the real diagrams → skipped.
  if (!renders("graph TD\n  A[probe] --> B[ok]\n", work, puppeteer)) {
    status =
      "skipped: mmdc preflight render failed (headless Chromium missing or misconfigured)";
  } else {
    const invalid = blocks
      .filter((b) => !renders(b.content, work, puppeteer))
      .map((b) => `${b.file}#${b.index}`);
    status = invalid.length > 0 ? `invalid: ${invalid.join(", ")}` : "ok";
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

emit(status);
