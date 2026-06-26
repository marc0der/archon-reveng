/**
 * Unit tests for `reveng-screen-cap.ts` (spec §7.2 / §10).
 *
 * Each case drives a fresh temp directory tree and runs the script with that
 * tree as cwd (argument-free, cwd-relative). We assert only the observable
 * loop-control contract — the exit code — never internals.
 *
 * The exit-code semantics ARE the contract the loop depends on: 0 = done
 * (stop), non-zero = continue. Getting these inverted would either spin the
 * loop forever or stop it before the work is finished, so each branch
 * (all-matched / any-missing / empty-vacuous) is pinned explicitly.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "reveng-screen-cap.ts");

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "reveng-screen-cap-"));
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

describe("reveng-screen-cap", () => {
  test("done (exit 0) when every screenshot has its HTML", () => {
    put("screenshots/login.png");
    put("screenshots/home.jpg");
    put("output/html/login.html");
    put("output/html/home.html");
    expect(run().exitCode).toBe(0);
  });

  test("continue (non-zero) while any screenshot lacks its HTML", () => {
    put("screenshots/login.png");
    put("screenshots/home.jpg");
    put("output/html/login.html"); // home.html missing
    const { exitCode, stderr } = run();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("home.jpg");
    expect(stderr).not.toContain("login.png");
  });

  test("continue (non-zero) when no HTML has been produced yet", () => {
    put("screenshots/login.png");
    expect(run().exitCode).not.toBe(0);
  });

  test("empty screenshots/ is vacuously done (exit 0)", () => {
    mkdirSync(join(workspace, "screenshots"));
    expect(run().exitCode).toBe(0);
  });

  test("absent screenshots/ is vacuously done (exit 0)", () => {
    expect(run().exitCode).toBe(0);
  });

  test("ignores non-image files in screenshots/ when deciding done", () => {
    put("screenshots/notes.txt"); // not a recognised image — not work
    put("screenshots/login.png");
    put("output/html/login.html");
    expect(run().exitCode).toBe(0);
  });

  test("matches HTML by basename across recognised image extensions", () => {
    put("screenshots/dashboard.WEBP"); // case-insensitive extension
    put("output/html/dashboard.html");
    expect(run().exitCode).toBe(0);
  });

  test("a stray HTML with no screenshot does not block done", () => {
    put("screenshots/login.png");
    put("output/html/login.html");
    put("output/html/orphan.html"); // extra output, no matching input
    expect(run().exitCode).toBe(0);
  });
});
