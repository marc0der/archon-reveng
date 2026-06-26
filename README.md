# archon-reveng

Reverse-engineer a legacy application into a **PRD and decomposed feature specs** from its
screenshots, transcripts, and source — as a single declarative [Archon](https://github.com/marc0der/Archon)
workflow.

`archon-reveng` ports the [reveng](https://github.com/marc0der/reveng) pipeline into one
**human-in-the-loop DAG**: a graph of analysis phases that runs the deterministic, parallelisable
work for you and **pauses at two approval gates** so a human can steer the result. It is the
reverse-engineering companion to [archon-ralph](https://github.com/marc0der/archon-ralph) (which
runs the forward plan/build loop), and is packaged the same way — a `template/` tree vendored into a
project's `.archon/` by a `bunx` installer.

## The mental model — a HITL DAG

Give it three inputs (`screenshots/`, `transcripts/`, `src/`); it produces an `output/` tree of
analyses, a PRD, a feature plan, and one spec per feature. Between those, it stops twice for you:

```
inputs ─▶ precondition ─▶ ┌ behaviour-extraction ┐
                          ├ schema-extraction     ├─▶ domain-modelling     ┐
                          ├ screen-reconstruction │   interaction-mapping  ├─▶ requirements-synthesis
                          └ interview-curation    ┘                        ┘            │
                                                                                        ▼
                                                                                 mermaid-validate
                                                                                        │
                                                              ╔═════════════════════════▼═══╗
                                                              ║  GATE 1 — review the PRD     ║
                                                              ╚═════════════════════════╤═══╝
                                                                                        ▼
                                                                             feature-decomposition
                                                              ╔═════════════════════════▼═══╗
                                                              ║  GATE 2 — review the plan    ║
                                                              ╚═════════════════════════╤═══╝
                                                                                        ▼
                                                              feature-specification ─▶ report
```

The two loops (`screen-reconstruction`, `interview-curation`) chew through one file per fresh
iteration until every screenshot has an HTML mockup and every transcript a curated version. The
extraction and modelling nodes run in parallel where the graph allows. Everything between the gates
is automatic; the gates are where you read, hand-edit, and decide.

## Requirements

| Dependency | When | Why |
|------------|------|-----|
| **[marc0der/Archon](https://github.com/marc0der/Archon)** — the **fork**, not upstream | build + runtime | Runs the workflow and provides the `archon validate` CLI. See [Why the fork?](#why-the-fork) below. |
| **[Bun](https://bun.sh)** | build **and runtime** | A *runtime* dependency: the workflow's `script:` nodes and the loop `until_bash` checks execute via `bun run`, and `bunx` runs the installer. Bun must be on `PATH` wherever Archon runs. |
| **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)**, authenticated | runtime | The `claude` provider that executes the command and loop nodes. |
| **git** | build + runtime | The repository and Archon's run model. |
| `mmdc` (mermaid-cli) + a headless **Chromium** | optional (runtime) | Mermaid diagram validation (`mermaid-validate`). Absent → the validator reports `skipped`, never a false failure. `shell.nix` bundles both. |

The installed `.archon/` tree has **no runtime npm dependencies** — the control scripts import only
Node built-ins. `template/package.json` carries `@types/bun` as a dev-dependency for type-checking
and editor DX only.

## Why the fork?

The two curation loops resolve `loop.command:` to an **extracted command file**
(`.archon/commands/*.md`). That resolution isn't supported in upstream Archon yet — it's a change
carried in [marc0der/Archon](https://github.com/marc0der/Archon). Upstream Archon will not run this
workflow.

## Install into a project

```bash
cd your-project
bunx github:marc0der/archon-reveng init
```

This (mirroring `reveng init`):

- Copies the pipeline machinery — workflow, command prompts, control scripts, Bun project files —
  into **`.archon/`**. Existing files are **skipped** to preserve local edits; pass `--force` to
  overwrite them.
- Scaffolds the workspace **input/output directories**: `screenshots/`, `transcripts/`, `src/`,
  `output/` (skip-if-present).
- Appends the regeneratable intermediates to **`.gitignore`** (`output/html/`,
  `output/transcripts/*_curated.txt`), skipping entries already there.

Flags: `--force` / `-f` (overwrite template files), `--dir <path>` (target root; default the current
directory), `--help` / `-h`.

## Inputs

Populate the three input directories before running. The `precondition` node fails the run, naming
any that is empty.

| Directory | Holds |
|-----------|-------|
| `screenshots/` | One image per legacy screen (`.png`, `.jpg`, …). Each becomes an HTML mockup under `output/html/`. |
| `transcripts/` | Plain-text (`*.txt`) interviews / walkthroughs with users and domain experts. Each is curated into `output/transcripts/<name>_curated.txt`. |
| `src/` | The legacy application's source tree. Read (never modified) to extract behaviour and the data schema. |

The pipeline is **stack-agnostic** — it discovers the target's language, framework, and database at
runtime.

## Run the workflow

```bash
archon workflow run reveng
```

Run it in the **foreground** — the two approval gates need an attached human. **Never** use
`--detach`, and run only **one reveng run per workspace** at a time (it works in the live checkout,
not a worktree). The optional free-text argument to `run` is just a run label; it has no effect on
the pipeline.

The run proceeds automatically until it reaches a gate, then pauses.

## Resolving the two gates

When a run pauses, find it and inspect the deliverable, then act on it.

```bash
archon workflow runs              # list runs; find the paused one and its <run-id>
archon workflow status <run-id>   # see which gate it is waiting at
```

At each gate you have three actions:

```bash
archon workflow approve <run-id>                 # accept and continue (hand-edits are honoured)
archon workflow reject  "<feedback>" <run-id>    # branch 1: regenerate from your feedback
archon workflow abandon <run-id>                 # branch 2: end the run
```

**Gate 1 — the PRD** (after `mermaid-validate`). Review `output/PRD.md` and the `mermaid-validate`
status line.

- **approve** → proceed to feature decomposition. Any edits you made to `output/PRD.md` during the
  pause are carried forward.
- **reject "<feedback>"** → *branch 1*: the PRD is regenerated from your feedback (up to 3 attempts).
- **abandon** → *branch 2*: if the PRD's **Open Questions** call for information you don't yet have,
  abandon the run, gather the missing interviews, drop the new transcripts into `transcripts/`, and
  **re-run** from the top. The Open Questions section is the interview brief for this branch.

**Gate 2 — the feature plan** (after `feature-decomposition`). Review `output/feature-plan.md` (the
`FT-NNN` features and their dependency layers).

- **approve** → write one spec per feature, then report.
- **reject "<feedback>"** → regenerate the feature plan from your feedback (up to 3 attempts).
- **abandon** → end the run.

## Outputs

Everything lands under `output/`. Two kinds:

**Committed deliverables** (the durable record of the analysis):

- `output/behaviour-analysis.md`, `output/schema-analysis.md`, `output/domain-analysis.md`,
  `output/interaction-analysis.md` — the four analyses
- `output/PRD.md` — the product requirements document (with its **Open Questions** section)
- `output/feature-plan.md` — the dependency-layered `FT-NNN` feature list
- `output/features/FT-*.md` — one specification per feature

**Gitignored intermediates** (regenerated on every run, so not committed):

- `output/html/<name>.html` — the reconstructed screen mockups
- `output/transcripts/<name>_curated.txt` — the curated transcripts

The final `report` node prints a read-only summary — mockup / curated-transcript / feature-spec
counts, which analyses and the PRD are present, the number of Open Questions, and the
`mermaid-validate` status — and writes nothing.

## Troubleshooting

- **Mermaid diagrams show as `skipped`.** `mmdc` or its Chromium isn't usable. The validator
  self-probes and degrades to `skipped` by design — it never fails the run or reports a false
  `invalid`. To enable real validation, either run inside the bundled Nix shell:

  ```bash
  nix-shell        # provides mmdc + a headless Chromium and sets PUPPETEER_EXECUTABLE_PATH
  ```

  or install it manually: `npm i -g @mermaid-js/mermaid-cli` **plus** a system Chromium.
- **A run won't start / behaves oddly.** Only one reveng run per workspace at a time — it runs in
  the live checkout. Make sure no other run is in progress.
- **The run can't find a command file.** You're on upstream Archon. Install the
  [marc0der/Archon](https://github.com/marc0der/Archon) fork (see [Why the fork?](#why-the-fork)).

## For maintainers

The pipeline machinery lives in this package's **`template/`** tree; the installer vendors it into a
project's **`.archon/`** verbatim (skipping `node_modules/`). To iterate on the pipeline, edit the
files under `template/` and re-install over a project with:

```bash
bunx github:marc0der/archon-reveng init --force
```

`--force` overwrites the template files in `.archon/`; the workspace directories and `.gitignore`
entries are always skip-if-present and never clobbered.

Validate before committing changes to the pipeline (needs the fork installed):

```bash
bun test                              # unit tests for the deterministic control scripts
archon validate workflows reveng      # graph resolves, both gates well-formed, loops carry until
archon validate commands              # every command: / loop.command: resolves to a file
```

## License

MIT
