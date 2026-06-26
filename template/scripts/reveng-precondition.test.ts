/**
 * Unit tests for `reveng-precondition.ts` (spec §7.1 / §10).
 *
 * Each case drives a fresh temp directory tree and runs the script with that
 * tree as cwd (the script is argument-free and cwd-relative). We assert only
 * observable behaviour — the exit code and the stderr naming of missing
 * inputs — never internals, mirroring the spec's testing seam.
 *
 * "All three populated → exit 0" is the happy path the workflow gate depends
 * on; the "each missing names the offender" cases prove the diagnostic is
 * actionable (a human must know *which* input to supply).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "reveng-precondition.ts");

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "reveng-precondition-"));
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

/** Run the precondition script with the temp workspace as cwd. */
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

/** Populate all three inputs with valid content. */
function seedAll(): void {
  put("screenshots/login.png");
  put("transcripts/interview-1.txt");
  put("src/index.ts");
}

describe("reveng-precondition", () => {
  test("exits 0 when all three inputs are populated", () => {
    seedAll();
    expect(run().exitCode).toBe(0);
  });

  test("accepts any recognised image extension and a nested source file", () => {
    put("screenshots/home.WEBP"); // case-insensitive extension match
    put("transcripts/chat.txt");
    put("src/app/components/Button.tsx"); // discovered recursively
    expect(run().exitCode).toBe(0);
  });

  test("fails naming screenshots/ when it is missing", () => {
    put("transcripts/interview-1.txt");
    put("src/index.ts");
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("screenshots/");
    expect(stderr).not.toContain("transcripts/");
    expect(stderr).not.toContain("src/");
  });

  test("fails naming transcripts/ when it is missing", () => {
    put("screenshots/login.png");
    put("src/index.ts");
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("transcripts/");
    expect(stderr).not.toContain("screenshots/");
    expect(stderr).not.toContain("src/");
  });

  test("fails naming src/ when it is missing", () => {
    put("screenshots/login.png");
    put("transcripts/interview-1.txt");
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("src/");
    expect(stderr).not.toContain("screenshots/");
    expect(stderr).not.toContain("transcripts/");
  });

  test("fails naming all three when the workspace is empty", () => {
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("screenshots/");
    expect(stderr).toContain("transcripts/");
    expect(stderr).toContain("src/");
  });

  test("treats a screenshots/ dir with only non-image files as missing", () => {
    put("screenshots/readme.txt"); // not a recognised image
    put("transcripts/interview-1.txt");
    put("src/index.ts");
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("screenshots/");
  });

  test("treats a transcripts/ dir with no .txt files as missing", () => {
    put("screenshots/login.png");
    put("transcripts/interview-1.md"); // not a .txt
    put("src/index.ts");
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("transcripts/");
  });

  test("treats present-but-empty input directories as missing", () => {
    mkdirSync(join(workspace, "screenshots"));
    mkdirSync(join(workspace, "transcripts"));
    mkdirSync(join(workspace, "src"));
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("screenshots/");
    expect(stderr).toContain("transcripts/");
    expect(stderr).toContain("src/");
  });
});
