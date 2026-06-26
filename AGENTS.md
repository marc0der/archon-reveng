# AGENTS.md

Guidance for any agent (Claude Code, ralph loop iterations) working in this repository.
Use British English in all prose and prompts.

## What is archon-reveng?

`archon-reveng` is a standalone package that ports the [reveng](https://github.com/marc0der/reveng)
reverse-engineering pipeline into a **single declarative [Archon](https://github.com/marc0der/Archon)
workflow** — a DAG of analysis phases that pauses at two human-approval gates and produces a PRD and
decomposed feature specs from a legacy app's screenshots, transcripts, and source. It is the
reverse-engineering companion to [archon-ralph](https://github.com/marc0der/archon-ralph), packaged
the same way (a `template/` tree vendored into a project's `.archon/` by a `bin/` installer).

The package is **being built from a spec** — most of it does not exist yet.

## Start here

- **`specs/archon-reveng.md` is the single source of truth.** Read it before every task. It defines
  the DAG, every node, the command-prompt ports, the control scripts, the two gates, the models,
  the tests, and the **Definition of Done** (spec §11). Do not invent behaviour not in the spec.
- Build the work-list in `IMPLEMENTATION_PLAN.md`; record progress in `PROGRESS.md` (ralph artifacts).
- Command prompts are **port-and-adapt** from reveng (spec §6) — adapt the existing prompts, do not
  author them from scratch.

## Reference repositories (read-only context)

| Repo | Use for |
|------|---------|
| [`marc0der/reveng`](https://github.com/marc0der/reveng) | Source prompts to port; pipeline behaviour, inputs, output contract |
| [`marc0der/Archon`](https://github.com/marc0der/Archon) | Workflow YAML schema; the `archon validate` CLI; runtime |
| [`marc0der/archon-ralph`](https://github.com/marc0der/archon-ralph) | The working example to mirror for packaging (installer, scripts, workflow YAML) |

## Critical constraints (don't rediscover these)

- **Requires the `marc0der/Archon` fork, not upstream** — the curation loops use `loop.command:`
  (external command files), which only the fork resolves.
- **`loop` nodes require `until:` *and* `max_iterations`** even when `until_bash` is the real stop
  (Archon schema). Use a sentinel `until:` + the cap script.
- **Runs in the live checkout**: `worktree.enabled: false`, `interactive: true`. Never run with
  `--detach` — the gates need an attached human.
- **`requirements-synthesis` is the heaviest port** — strip the product-manager prompt's
  orchestration (it otherwise spawns analyst subagents that don't exist here). See spec §6.
- **`mmdc` needs a headless Chromium** — the validator self-probes and degrades to `skipped`, never
  failing the run. See spec §7.4.
- **Discipline naming + realigned output filenames** are deliberate — follow spec §6 / §7.6 exactly
  (`behaviour-analysis.md`, `schema-analysis.md`, etc.).

## Build & validate

- `bun test` — unit tests for the deterministic control scripts (`template/scripts/*.test.ts`).
- `archon validate workflows reveng` and `archon validate commands` — the workflow/command
  validation seam (needs the fork installed).
- The build is **complete** when the Definition of Done (spec §11) is met. No live end-to-end Claude
  run is required.

## Conventions

- British English; keep prompts **stack-agnostic** (discover the target's language/framework/DB at
  runtime — see reveng's conventions).
- Commit with the `/commit` skill — atomic Conventional Commits, imperative subject ≤50 chars.
- This package is **additive**: never modify reveng's CLI behaviour.
