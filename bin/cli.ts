#!/usr/bin/env bun
/**
 * archon-reveng — scaffold the reveng reverse-engineering Archon workflow into
 * a project.
 *
 * Ported from archon-ralph's installer (spec §8). Copies the project-agnostic
 * pipeline machinery (workflow, command prompts, deterministic control
 * scripts, Bun project files) from this package's `template/` directory into
 * the target project's `.archon/` directory, then — mirroring `reveng init` —
 * scaffolds the workspace input/output directories and registers the
 * regeneratable intermediates in `.gitignore`.
 *
 * Usage:
 *   bunx archon-reveng init [--force] [--dir <path>]
 *
 *   init            Copy template files into <dir>/.archon/, skipping any file
 *                   that already exists (preserves local edits); create the
 *                   workspace dirs (screenshots/, transcripts/, src/, output/)
 *                   and append the intermediate-output globs to .gitignore.
 *   --force, -f     Overwrite existing template files instead of skipping them.
 *                   (Workspace dirs and .gitignore entries are always
 *                   skip-if-present — never clobbered.)
 *   --dir <path>    Target project root (default: current directory).
 *   --help, -h      Show this help.
 *
 * The scripts under `template/scripts/` import only Node built-ins, so the
 * installed `.archon/` needs no runtime dependencies — `bun install` inside it
 * is optional and only pulls `@types/bun` for editor/type-check DX.
 */

import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "template");
const ARCHON_DIR = ".archon";

/**
 * Workspace input/output directories scaffolded alongside `.archon/`, matching
 * `reveng init` (spec §8 / resolved decision 8). The three inputs are the
 * `precondition` node's contract (spec §7.1); `output/` receives every
 * deliverable.
 */
const WORKSPACE_DIRS = ["screenshots", "transcripts", "src", "output"];

/**
 * Regeneratable intermediates gitignored as reveng does (spec §7.6): rebuilt
 * HTML mockups and curated transcripts. The analyses, PRD and feature specs
 * are deliberately *not* listed — they are committed deliverables.
 */
const GITIGNORE_ENTRIES = ["output/html/", "output/transcripts/*_curated.txt"];

interface Options {
  force: boolean;
  dir: string;
}

function parseArgs(argv: readonly string[]): Options {
  const opts: Options = { force: false, dir: "." };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--force":
      case "-f":
        opts.force = true;
        break;
      case "--dir": {
        const next = argv[i + 1];
        if (!next) {
          console.error("archon-reveng: --dir requires a path argument");
          process.exit(1);
        }
        opts.dir = next;
        i += 1;
        break;
      }
      default:
        console.error(`archon-reveng: unknown argument '${arg}'`);
        process.exit(1);
    }
  }
  return opts;
}

/**
 * Template files relative to `root`, sorted for stable output. `node_modules/`
 * is skipped so a local `bun install` inside `template/` never gets vendored
 * into a project's `.archon/` (the installed tree has no runtime deps).
 */
function listTemplateFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules") continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(relative(root, full));
    }
  };
  walk(root);
  return files.sort();
}

const HELP = `archon-reveng — scaffold the reveng reverse-engineering Archon workflow into a project.

Usage:
  bunx archon-reveng init [--force] [--dir <path>]

Commands:
  init            Copy the workflow, command prompts, control scripts and Bun
                  project files into <dir>/.archon/, then scaffold the workspace
                  dirs (screenshots/, transcripts/, src/, output/) and append the
                  intermediate-output globs to .gitignore. Existing template
                  files are skipped unless --force; workspace dirs and .gitignore
                  entries are always skip-if-present.

Options:
  --force, -f     Overwrite existing template files instead of skipping them.
  --dir <path>    Target project root (default: current directory).
  --help, -h      Show this help.`;

/** Copy the vendored `template/` tree into `<dir>/.archon/`. */
function installTemplate(opts: Options): void {
  const dest = join(opts.dir, ARCHON_DIR);
  const files = listTemplateFiles(TEMPLATE_DIR);
  let created = 0;
  let skipped = 0;

  for (const rel of files) {
    const target = join(dest, rel);
    const existed = existsSync(target);
    if (existed && !opts.force) {
      console.log(`  skip   ${join(ARCHON_DIR, rel)} (exists)`);
      skipped += 1;
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(TEMPLATE_DIR, rel), target);
    console.log(`  ${existed ? "write " : "create"} ${join(ARCHON_DIR, rel)}`);
    created += 1;
  }

  console.log(
    `\narchon-reveng: ${created} file(s) written, ${skipped} skipped into ${dest}/`,
  );
  if (skipped > 0) console.log("Re-run with --force to overwrite skipped files.");
}

/** Create the workspace input/output dirs, skipping any that already exist. */
function scaffoldWorkspace(opts: Options): void {
  for (const name of WORKSPACE_DIRS) {
    const target = join(opts.dir, name);
    if (existsSync(target)) {
      console.log(`  skip   ${name}/ (exists)`);
      continue;
    }
    mkdirSync(target, { recursive: true });
    console.log(`  create ${name}/`);
  }
}

/**
 * Append the §7.6 intermediate globs to `<dir>/.gitignore`, skipping entries
 * already present. Creates the file when absent; never rewrites existing lines.
 */
function updateGitignore(opts: Options): void {
  const path = join(opts.dir, ".gitignore");
  const existing = existsSync(path)
    ? new Set(
        readFileSync(path, "utf8")
          .split("\n")
          .map((line) => line.trim()),
      )
    : new Set<string>();

  const missing = GITIGNORE_ENTRIES.filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    console.log("  skip   .gitignore (entries present)");
    return;
  }

  if (existsSync(path)) {
    const current = readFileSync(path, "utf8");
    const leadingNewline = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(path, `${leadingNewline}${missing.join("\n")}\n`);
    console.log(`  update .gitignore (+${missing.length})`);
  } else {
    appendFileSync(path, `# archon-reveng intermediates\n${missing.join("\n")}\n`);
    console.log(`  create .gitignore (+${missing.length})`);
  }
}

function runInit(opts: Options): void {
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`archon-reveng: template directory missing at ${TEMPLATE_DIR}`);
    process.exit(1);
  }

  installTemplate(opts);
  console.log("\nWorkspace:");
  scaffoldWorkspace(opts);
  updateGitignore(opts);

  console.log("\nNext:");
  console.log("  1. Populate screenshots/, transcripts/ and src/ with the legacy app's inputs.");
  console.log("  2. Run the workflow (foreground — the gates need an attached human):");
  console.log("       archon workflow run reveng");
}

const [command, ...rest] = process.argv.slice(2);

if (command === "--help" || command === "-h" || command === undefined) {
  console.log(HELP);
  process.exit(0);
}

if (command !== "init") {
  console.error(`archon-reveng: unknown command '${command}'. Run with --help.`);
  process.exit(1);
}

runInit(parseArgs(rest));
