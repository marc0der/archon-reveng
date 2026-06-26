/**
 * Unit tests for `reveng-mermaid-validate.ts` (spec §7.4 / §10).
 *
 * Each case drives a fresh temp directory tree and runs the script with that
 * tree as cwd (argument-free, cwd-relative). We assert only observable
 * behaviour — the exit code (ALWAYS 0) and the stdout status line — never
 * internals.
 *
 * The script never fails the run: a tooling fault degrades to `skipped`, so the
 * always-exit-0 contract is pinned in every case. The "present" cases (a real
 * `mmdc` render) are gated on a working mmdc + headless Chromium and skipped
 * otherwise (spec §8.1) — the mmdc-absent path is the one that always runs.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "reveng-mermaid-validate.ts");

/**
 * Detect whether mmdc can actually render here (binary present AND headless
 * Chromium usable) by doing the same trivial probe the script does. Gates the
 * "present" cases so they run only where the optional toolchain works.
 */
function mmdcRenders(): boolean {
  let work: string | undefined;
  try {
    work = mkdtempSync(join(tmpdir(), "reveng-mermaid-probe-"));
    const cfg = join(work, "p.json");
    const input = join(work, "d.mmd");
    const output = join(work, "d.svg");
    writeFileSync(cfg, JSON.stringify({ args: ["--no-sandbox"] }));
    writeFileSync(input, "graph TD\n  A --> B\n");
    const r = spawnSync(
      "mmdc",
      ["--puppeteerConfigFile", cfg, "--input", input, "--output", output],
      { stdio: "ignore" },
    );
    return !r.error && r.status === 0;
  } catch {
    return false;
  } finally {
    if (work) rmSync(work, { recursive: true, force: true });
  }
}

const MMDC = mmdcRenders();
const testWithMmdc = MMDC ? test : test.skip;

const VALID_BLOCK = "```mermaid\ngraph TD\n  A[Start] --> B[End]\n```\n";
const BROKEN_BLOCK = "```mermaid\nthis is not valid mermaid syntax !!!\n```\n";

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "reveng-mermaid-validate-"));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** Create a file (and any parent dirs) at `relPath` under the workspace. */
function put(relPath: string, contents = ""): void {
  const abs = join(workspace, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, contents);
}

/**
 * Run the validator with the temp workspace as cwd. `noMmdc` clears PATH so the
 * script cannot resolve `mmdc`, exercising the absent path deterministically
 * regardless of the host; bun itself is invoked by absolute path so it still
 * launches with an empty PATH.
 */
function run(noMmdc = false): { exitCode: number; stdout: string } {
  const env = noMmdc
    ? { ...process.env, PATH: "" }
    : { ...process.env };
  const proc = Bun.spawnSync([process.execPath, "run", SCRIPT], {
    cwd: workspace,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString().trim(),
  };
}

describe("reveng-mermaid-validate", () => {
  test("always exits 0, even with broken diagrams (never blocks the run)", () => {
    put("output/PRD.md", BROKEN_BLOCK);
    expect(run().exitCode).toBe(0);
  });

  test("no mermaid blocks anywhere → ok (nothing to validate)", () => {
    put("output/PRD.md", "# PRD\n\nNo diagrams here.\n");
    put("output/domain-analysis.md", "# Domain\n");
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe("ok");
  });

  test("no output files at all → ok", () => {
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe("ok");
  });

  test("mmdc absent with blocks present → skipped (exit 0), names reason", () => {
    put("output/PRD.md", VALID_BLOCK);
    const { exitCode, stdout } = run(true);
    expect(exitCode).toBe(0);
    expect(stdout.startsWith("skipped:")).toBe(true);
    expect(stdout).toContain("mmdc");
  });

  test("mmdc absent is not consulted when there are no blocks → ok", () => {
    put("output/PRD.md", "# PRD\n");
    const { stdout } = run(true);
    expect(stdout).toBe("ok");
  });

  testWithMmdc("present + all valid → ok", () => {
    put("output/domain-analysis.md", VALID_BLOCK);
    put("output/PRD.md", VALID_BLOCK);
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe("ok");
  });

  testWithMmdc("present + a broken block → invalid names the file and block", () => {
    put("output/domain-analysis.md", VALID_BLOCK);
    put("output/PRD.md", BROKEN_BLOCK);
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout.startsWith("invalid:")).toBe(true);
    expect(stdout).toContain("output/PRD.md#1");
    expect(stdout).not.toContain("output/domain-analysis.md");
  });

  testWithMmdc("present + multiple blocks in one file → reports the broken index", () => {
    put("output/PRD.md", `${VALID_BLOCK}\n${BROKEN_BLOCK}`);
    const { stdout } = run();
    expect(stdout.startsWith("invalid:")).toBe(true);
    expect(stdout).toContain("output/PRD.md#2");
  });
});
