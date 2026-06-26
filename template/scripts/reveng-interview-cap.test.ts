/**
 * Unit tests for `reveng-interview-cap.ts` (spec §7.3 / §10).
 *
 * Each case drives a fresh temp directory tree and runs the script with that
 * tree as cwd (argument-free, cwd-relative). We assert only the observable
 * loop-control contract — the exit code — never internals.
 *
 * The exit-code semantics ARE the contract the loop depends on: 0 = done
 * (stop), non-zero = continue. Getting these inverted would either spin the
 * loop forever or stop it before the work is finished, so each branch
 * (all-matched / any-missing / empty-vacuous) is pinned explicitly — symmetric
 * to `reveng-screen-cap.test.ts`, plus the transcript-specific `_curated.txt`
 * exclusion (a curated artefact must never be treated as fresh input).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "reveng-interview-cap.ts");

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "reveng-interview-cap-"));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

/** Create a file (and any parent dirs) at `relPath` under the workspace. */
function put(relPath: string, contents = "x"): void {
  const abs = join(workspace, relPath);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, contents);
}

/** Run the cap script with the temp workspace as cwd. */
function run(): { exitCode: number; stderr: string } {
  const proc = Bun.spawnSync(["bun", "run", SCRIPT], {
    cwd: workspace,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: proc.exitCode,
    stderr: proc.stderr.toString(),
  };
}

describe("reveng-interview-cap", () => {
  test("done (exit 0) when every transcript has its curated copy", () => {
    put("transcripts/alice.txt");
    put("transcripts/bob.txt");
    put("output/transcripts/alice_curated.txt");
    put("output/transcripts/bob_curated.txt");
    expect(run().exitCode).toBe(0);
  });

  test("continue (non-zero) while any transcript lacks its curated copy", () => {
    put("transcripts/alice.txt");
    put("transcripts/bob.txt");
    put("output/transcripts/alice_curated.txt"); // bob missing
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("bob.txt");
    expect(stderr).not.toContain("alice.txt");
  });

  test("continue (non-zero) when no transcript has been curated yet", () => {
    put("transcripts/alice.txt");
    expect(run().exitCode).not.toBe(0);
  });

  test("empty transcripts/ is vacuously done (exit 0)", () => {
    mkdirSync(join(workspace, "transcripts"));
    expect(run().exitCode).toBe(0);
  });

  test("absent transcripts/ is vacuously done (exit 0)", () => {
    expect(run().exitCode).toBe(0);
  });

  test("ignores non-txt files in transcripts/ when deciding done", () => {
    put("transcripts/notes.md"); // not a transcript — not work
    put("transcripts/alice.txt");
    put("output/transcripts/alice_curated.txt");
    expect(run().exitCode).toBe(0);
  });

  test("a stray *_curated.txt in transcripts/ is not itself an input", () => {
    // A curated artefact sitting in the source dir must not demand its own
    // `_curated_curated.txt`, which would never be produced and would wedge
    // the loop forever.
    put("transcripts/alice.txt");
    put("transcripts/alice_curated.txt"); // excluded from the work-list
    put("output/transcripts/alice_curated.txt");
    expect(run().exitCode).toBe(0);
  });

  test("matches curated copy by basename regardless of .txt case", () => {
    put("transcripts/dashboard.TXT"); // case-insensitive extension
    put("output/transcripts/dashboard_curated.txt");
    expect(run().exitCode).toBe(0);
  });

  test("a stray curated copy with no transcript does not block done", () => {
    put("transcripts/alice.txt");
    put("output/transcripts/alice_curated.txt");
    put("output/transcripts/orphan_curated.txt"); // no matching input
    expect(run().exitCode).toBe(0);
  });
});
