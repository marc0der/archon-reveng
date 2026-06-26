# archon-reveng — Build Specification

> Build target for an autonomous plan/build loop. Everything required to produce a complete
> implementation plan is in this document or in the three public `marc0der` repositories named
> under **Reference Material**. Read those rather than reinventing their contents.

## 1. Purpose & Scope

Port the [reveng](https://github.com/marc0der/reveng) reverse-engineering pipeline — today
three independent headless CLI commands (`curate`, `synth`, `decompose`) — into a single
declarative [Archon](https://github.com/marc0der/Archon) workflow, packaged like
[archon-ralph](https://github.com/marc0der/archon-ralph).

The workflow runs a DAG of analysis phases, pauses at two human-approval gates, and produces a
PRD and decomposed feature specs from a legacy application's screenshots, transcripts, and
source. It is the reverse-engineering sibling of archon-ralph (which is the re-engineering
loop).

**In scope:** a standalone `archon-reveng` package — installer, workflow definition, ported
command prompts, deterministic control scripts, supporting files, and tests.

**Out of scope:** see §12. Notably: no changes to reveng's CLI (this is additive), no archive
phase, no data-driven input registry, no live end-to-end run in the build's definition of done.

**Mental model in one line:** archon-ralph is an autonomous loop that runs to a budget;
archon-reveng is a human-in-the-loop DAG that runs to completion but *stops and hands control
to the user* at two review points.

## 2. Reference Material

Three public repositories under [github.com/marc0der](https://github.com/marc0der). Use each for
a specific purpose; do not duplicate their content into this package beyond the adaptations in
§6–§7. File links below use `blob/HEAD` / `tree/HEAD` so they resolve against each repo's
default branch.

| Repo | Use it for | Key locations |
|------|-----------|---------------|
| [`marc0der/reveng`](https://github.com/marc0der/reveng) | Source prompts to port; the analysis pipeline's behaviour, inputs, and output contract | [`agents/*/AGENT.md`](https://github.com/marc0der/reveng/tree/HEAD/agents), [`skills/*/SKILL.md`](https://github.com/marc0der/reveng/tree/HEAD/skills), [`specs/reveng-cli.md`](https://github.com/marc0der/reveng/blob/HEAD/specs/reveng-cli.md), [`README.md`](https://github.com/marc0der/reveng/blob/HEAD/README.md) (pipeline + outputs tables; "Content curation stalls on large file sets"), [`templates/workspace-CLAUDE.md`](https://github.com/marc0der/reveng/blob/HEAD/templates/workspace-CLAUDE.md) |
| [`marc0der/Archon`](https://github.com/marc0der/Archon) | The workflow YAML schema and the validator to test against | [`packages/workflows/src/schemas/dag-node.ts`](https://github.com/marc0der/Archon/blob/HEAD/packages/workflows/src/schemas/dag-node.ts) (node fields), [`schemas/loop.ts`](https://github.com/marc0der/Archon/blob/HEAD/packages/workflows/src/schemas/loop.ts) (loop fields), [`loader.ts`](https://github.com/marc0der/Archon/blob/HEAD/packages/workflows/src/loader.ts) + [`validator.ts`](https://github.com/marc0der/Archon/blob/HEAD/packages/workflows/src/validator.ts) (+ their `*.test.ts`), [`dag-executor.ts`](https://github.com/marc0der/Archon/blob/HEAD/packages/workflows/src/dag-executor.ts) (approval/loop runtime), [`.archon/workflows/maintainer/marketplace-pr-review-and-merge.yaml`](https://github.com/marc0der/Archon/blob/HEAD/.archon/workflows/maintainer/marketplace-pr-review-and-merge.yaml) (real approval-node example) |
| [`marc0der/archon-ralph`](https://github.com/marc0der/archon-ralph) | The working example to mirror for packaging | [`bin/cli.ts`](https://github.com/marc0der/archon-ralph/blob/HEAD/bin/cli.ts) (installer), [`template/workflows/ralph-wiggum.yaml`](https://github.com/marc0der/archon-ralph/blob/HEAD/template/workflows/ralph-wiggum.yaml) (loop nodes, `until_bash`, `fresh_context`, workflow-level model), [`template/scripts/`](https://github.com/marc0der/archon-ralph/tree/HEAD/template/scripts) (`ralph-*-cap.ts` control-script + `until_bash` exit pattern; `ralph-seed.ts` script-node pattern), [`package.json`](https://github.com/marc0der/archon-ralph/blob/HEAD/package.json) (`bin`/`files`/`engines`) |

> **Required: the `marc0der/Archon` fork — not upstream.** This workflow's loop nodes
> (`screen-reconstruction`, `interview-curation`) use `loop.command:` to resolve an **external
> command file** (`.archon/commands/<name>.md`). Upstream Archon does not support extracting a
> loop's command to an external file; the fork adds it (the same dependency
> [archon-ralph documents](https://github.com/marc0der/archon-ralph/blob/HEAD/README.md#why-the-fork)).
> The workflow will not run correctly on upstream Archon. Build and validate against the fork.

**Engine facts** (✓ verified in source during spec review; ⚠ confirm during build):
- ✓ A `loop` node **requires both `until:` (non-empty completion-signal string) and `max_iterations`** — even when `until_bash` is the real stop condition (`loop.ts`). Omitting `until` fails validation. Use a sentinel `until:` the command emits only when no work remains, with `until_bash` authoritative (mirrors ralph).
- ✓ `loop.command:` resolves to an external command file (`.archon/commands/<name>.md`, repo→home→bundled precedence) — **fork-only**; upstream has no such resolution (`loop.ts`).
- ✓ `approval` supports `message`, `capture_response` (stores the comment as `$<id>.output`), and `on_reject` with `$REJECTION_REASON` substituted; resumed via `archon workflow approve|reject|abandon <run-id>` (`CLAUDE.md` + `dag-node` schema). `on_reject.max_attempts` ⚠ confirm.
- ✓ A node may declare inline sub-agents via the **`agents:` field**, invokable through the **Task** tool (Claude only) — used by `feature-specification` (`CLAUDE.md`).
- ✓ Validation is a CLI command: **`archon validate workflows <name>`** and **`archon validate commands`** (source form `bun run cli validate …`) — the validation seam; no need to import engine internals (`CLAUDE.md`).
- ⚠ `until_bash` exit code: **0 = complete (stop)**, non-zero = continue (confirm against `ralph-build-cap.ts`).
- ⚠ A `loop` node ignores a per-node `model:` (uses the workflow-level model); a `script` node fails the run on non-zero exit and captures stdout as output.
- ⚠ Script/loop nodes run in the **run working directory** = the live checkout root under `worktree.enabled: false`. Keep control scripts **argument-free** (resolve `screenshots/`, `output/…` from `cwd`) to avoid the `bun run` `--`-separator gotcha.
- ⚠ `worktree: { enabled: false }` pins the live checkout; `interactive: true` keeps the run foreground (required for gates).

## 3. Concepts

- **Phase / node** — one DAG node. Types used: `script` (bun), `command` (AI prompt from a
  command file), `loop` (iterated `command`), `approval` (human gate).
- **Gate** — an `approval` node that pauses the run. The human resolves it with one of three
  actions (§5).
- **Branch 1 (rework)** — at the PRD gate, `reject "<feedback>"` regenerates the artifact.
- **Branch 2 (re-interview)** — at the PRD gate, `abandon`; the human gathers more interviews,
  adds transcripts, and re-runs. Archon DAGs have no back-edges, so this is *abandon + re-run*,
  not an in-graph loop. Curation is idempotent (skip-if-done), so re-entry is cheap.
- **Idempotency** — every phase skips work whose output already exists, making re-runs and
  resumes safe.

## 4. Architecture

### 4.1 The DAG

```
precondition  (script)
   │
   ├── behaviour-extraction ──┐   (command; src/ only → runs ∥ curation)
   ├── schema-extraction ─────┤   (command; src/ only)
   │                          │
   ├── screen-reconstruction  │   (loop → output/html/*.html)
   ├── interview-curation     │   (loop → output/transcripts/*_curated.txt)
   │        │                 │
   │        ├── domain-modelling ───┤   (command → output/domain-analysis.md)
   │        └── interaction-mapping ┤   (command → output/interaction-analysis.md)
   │                                │
   └──── requirements-synthesis     (command → output/PRD.md)
                  │
          mermaid-validate          (script)
                  │
            prd-gate                (approval)
                  │
          feature-decomposition     (command → output/feature-plan.md)
                  │
            feature-plan-gate       (approval)
                  │
          feature-specification     (command → output/features/FT-*.md)
                  │
          report                    (command, sonnet)
```

### 4.2 Phase inventory

Each "Source to port" links the reveng prompt the command file derives from (§6).

| Node id (= command/script name) | Type | `depends_on` | Source to port (§6) / behaviour (§7) | Output |
|------|------|--------------|------------|--------|
| `precondition` | script | — | §7.1 | (validation) |
| `behaviour-extraction` | command | `precondition` | [`application-developer`](https://github.com/marc0der/reveng/blob/HEAD/agents/application-developer/AGENT.md) | `output/behaviour-analysis.md` |
| `schema-extraction` | command | `precondition` | [`database-analyst`](https://github.com/marc0der/reveng/blob/HEAD/agents/database-analyst/AGENT.md) | `output/schema-analysis.md` |
| `screen-reconstruction` | loop | `precondition` | [`image-to-html`](https://github.com/marc0der/reveng/blob/HEAD/skills/image-to-html/SKILL.md) | `output/html/*.html` |
| `interview-curation` | loop | `precondition` | [`curate-transcript`](https://github.com/marc0der/reveng/blob/HEAD/skills/curate-transcript/SKILL.md) | `output/transcripts/*_curated.txt` |
| `domain-modelling` | command | `interview-curation`, `screen-reconstruction` | [`business-analyst`](https://github.com/marc0der/reveng/blob/HEAD/agents/business-analyst/AGENT.md) | `output/domain-analysis.md` |
| `interaction-mapping` | command | `interview-curation`, `screen-reconstruction` | [`interaction-analyst`](https://github.com/marc0der/reveng/blob/HEAD/agents/interaction-analyst/AGENT.md) | `output/interaction-analysis.md` |
| `requirements-synthesis` | command | `behaviour-extraction`, `schema-extraction`, `domain-modelling`, `interaction-mapping` | [`product-manager`](https://github.com/marc0der/reveng/blob/HEAD/agents/product-manager/AGENT.md) | `output/PRD.md` |
| `mermaid-validate` | script | `requirements-synthesis` | §7.4 | (status) |
| `prd-gate` | approval | `mermaid-validate` | §5 | (gate) |
| `feature-decomposition` | command | `prd-gate` | [`prd-to-features`](https://github.com/marc0der/reveng/blob/HEAD/agents/prd-to-features/AGENT.md) (plan part) | `output/feature-plan.md` |
| `feature-plan-gate` | approval | `feature-decomposition` | §5 | (gate) |
| `feature-specification` | command | `feature-plan-gate` | [`prd-to-features`](https://github.com/marc0der/reveng/blob/HEAD/agents/prd-to-features/AGENT.md) (write part) + [`feature-writer`](https://github.com/marc0der/reveng/blob/HEAD/agents/feature-writer/AGENT.md) | `output/features/FT-*.md` |
| `report` | command | `feature-specification` | §7.5 | (stdout summary) |

### 4.3 Dependency rules

- `behaviour-extraction` and `schema-extraction` read only `src/` (a precondition input) and
  start immediately, in parallel with the two curation loops.
- `domain-modelling` and `interaction-mapping` consume curated content; they depend on **both**
  curation loops.
- `requirements-synthesis` joins all four analyses with the default `all_success` trigger rule
  (all three inputs are required, so no tolerant join is needed).
- The tail (`mermaid-validate` → `prd-gate` → `feature-decomposition` → `feature-plan-gate` →
  `feature-specification` → `report`) is strictly sequential.

## 5. Human-in-the-Loop Gates

Both gates are `approval` nodes with identical semantics:

| Action | CLI | Effect |
|--------|-----|--------|
| Approve | `archon workflow approve <run-id>` | Proceed using whatever is on disk (honours hand-edits). |
| Reject | `archon workflow reject <run-id> "<reason>"` | `on_reject` re-runs the producing phase with `$REJECTION_REASON`, then re-pauses; capped by `max_attempts`. |
| Abandon | `archon workflow abandon <run-id>` | Run ends. |

**`prd-gate`** follows `mermaid-validate`. Branch 1 = reject (regenerate the PRD). Branch 2 =
abandon (gather interviews, re-run). The PRD's **Open Questions** section is the interview brief
for branch 2. Definition fragment (authoritative for both gates, adapt id/message):

```yaml
- id: prd-gate
  depends_on: [mermaid-validate]
  approval:
    message: |
      Review output/PRD.md.
      - approve: proceed to feature decomposition (hand-edits honoured).
      - reject "<feedback>": regenerate the PRD from your feedback.
      - abandon: if the Open Questions need new interviews, abandon, add transcripts, re-run.
    on_reject:
      prompt: "User feedback: $REJECTION_REASON. Revise output/PRD.md accordingly."
      max_attempts: 3
```

**`feature-plan-gate`** follows `feature-decomposition`, with the same three actions; its
`on_reject` regenerates `output/feature-plan.md`. The decompose split (a plan phase that writes
the plan but spawns no writers, then this gate, then a write phase) is what makes this gate
real — reveng's `prd-to-features` agent intends a confirmation step but the headless CLI
bypasses it.

## 6. Command Prompts — port-and-adapt

Each `template/commands/<id>.md` is derived from a reveng prompt (linked in §4.2). Port the
prompt body into command form (strip agent frontmatter; keep the instructions), then apply the
listed delta. Preserve British English and the stack-agnostic stance
([`reveng/CLAUDE.md`](https://github.com/marc0der/reveng/blob/HEAD/CLAUDE.md)).

| Target | Source | Delta |
|--------|--------|-------|
| `domain-modelling.md` | `business-analyst` | Rename only; output path unchanged (`domain-analysis.md`). |
| `interaction-mapping.md` | `interaction-analyst` | Rename only; output unchanged (`interaction-analysis.md`). |
| `behaviour-extraction.md` | `application-developer` | Rename; change output to `behaviour-analysis.md`; update any in-text references to the old filename. |
| `schema-extraction.md` | `database-analyst` | Rename; change output to `schema-analysis.md`; update in-text references. |
| `requirements-synthesis.md` | `product-manager` | **Heaviest port — strip the orchestration.** The DAG already produced all four analyses, so delete the prompt's Steps 1–3 (curated-content prerequisite check; launching the code analysts; launching the domain/interaction analysts) and Step 7 (the `validate-mermaid` skill — now the `mermaid-validate` node). Keep only: read the four analysis files → cross-reference → write `output/PRD.md`, **preserving its §13 Open Questions section** (load-bearing for branch 2 + the report). Update the read-list to the renamed files (`behaviour-analysis.md`, `schema-analysis.md`); drop `Task` and `Skill` from its tools. |
| `screen-reconstruction.md` | `image-to-html` | Convert to a per-file loop body: "Process the **first** screenshot in sorted order under `screenshots/` that has no corresponding `output/html/<name>.html`; convert only that one." Fresh context per iteration. |
| `interview-curation.md` | `curate-transcript` | Convert to a per-file loop body: "Curate the **first** `transcripts/*.txt` (excluding `*_curated.txt`) that has no `output/transcripts/<name>_curated.txt`; curate only that one." |
| `feature-decomposition.md` | `prd-to-features` (plan part) | Keep the feature-list + dependency-layering logic; **assign each feature a stable `FT-NNN` id + layer** and write them to `output/feature-plan.md` (parallel writers depend on these ids). **Remove** the writer-spawning and the internal "wait for the user to confirm" step (the gate owns confirmation). |
| `feature-specification.md` | `prd-to-features` (write part) + `feature-writer` | Read the confirmed `output/feature-plan.md`; for each feature (by its `FT-NNN` id) spawn a `feature-writer` worker to write `output/features/FT-*.md`. Define the worker via the node's **`agents:` field** (inline sub-agent, Claude-only) and fire one **Task** per feature, in parallel. |
| `report.md` | (new — see §7.5) | — |

**Dissolved / replaced:** [`digital-content-curator`](https://github.com/marc0der/reveng/blob/HEAD/agents/digital-content-curator/AGENT.md)
is **not** ported — its orchestration role is taken over by the DAG and the two loops.
[`validate-mermaid`](https://github.com/marc0der/reveng/blob/HEAD/skills/validate-mermaid/SKILL.md)
is **replaced** by the deterministic `mermaid-validate` script (§7.4).

## 7. Control Scripts & Other Behaviour

All scripts are bun, in `template/scripts/`, importing only Node built-ins (mirror
[`archon-ralph/template/scripts/`](https://github.com/marc0der/archon-ralph/tree/HEAD/template/scripts)).
Each is a pure function of the filesystem and is unit-tested (§10).

### 7.1 `reveng-precondition.ts`
- **Behaviour:** assert all three required inputs are populated — `screenshots/` (≥1 file with
  a recognised image extension: png/jpg/jpeg/gif/bmp/webp), `transcripts/` (≥1 `*.txt`), `src/`
  (≥1 file, recursively). Exit 0 if all present; otherwise exit non-zero and print to stderr
  exactly which inputs are missing.
- **Acceptance:** passes when all three populated; fails naming the missing one(s) when any is
  empty/absent.

### 7.2 `reveng-screen-cap.ts` (loop `until_bash`)
- **Behaviour:** exit 0 when **every** screenshot has a matching `output/html/<name>.html`;
  non-zero otherwise. (Sorted order is enforced by the command prompt, not here.)
- **Acceptance:** "done" only when no screenshot is missing its HTML; "continue" while any
  remains. Empty `screenshots/` → "done" (vacuously true).

### 7.3 `reveng-interview-cap.ts` (loop `until_bash`)
- **Behaviour:** exit 0 when every `transcripts/*.txt` (excluding `*_curated.txt`) has a
  matching `output/transcripts/<name>_curated.txt`; non-zero otherwise.
- **Acceptance:** symmetric to §7.2.

### 7.4 `reveng-mermaid-validate.ts`
- **Dependency:** `mmdc` renders through a headless **Chromium (Puppeteer)** — the npm package
  alone is not enough; a Chromium must be present, and in sandboxed/CI/root contexts it must run
  with `--no-sandbox` (a Puppeteer config file). `shell.nix` provides both (§8).
- **Behaviour:** find mermaid code blocks in `output/domain-analysis.md`,
  `output/interaction-analysis.md`, and `output/PRD.md`. **Preflight self-probe:** first render a
  trivial known-good diagram. If `mmdc` is absent **or** the probe fails (Chromium
  missing/misconfigured), report `skipped` (with reason) and exit 0 — never mark real diagrams
  `invalid` on a tooling fault. Only when the probe succeeds do per-block render failures count.
  Write a status line to stdout consumed by `report` (`skipped: <reason>` | `ok` |
  `invalid: <files/blocks>`). **Never fails the run** (exit 0 always) — it surfaces, it does not
  block; the human sees broken diagrams at the PRD gate. No auto-fixing.
- **Acceptance:** `mmdc` absent **or** Chromium unusable → exits 0, status `skipped` with reason;
  probe OK + a broken block → exits 0, status names the offending file/block; all valid → `ok`.

### 7.5 `report` command
- **Behaviour:** read-only summary printed to stdout: counts of HTML mockups, curated
  transcripts, and feature specs produced; the four analyses + PRD presence; the **number of
  Open Questions** in `output/PRD.md` (the product-manager prompt's §13 *Open Questions* list — confirmed present); and the mermaid-validate status. Writes nothing.
- **Model:** `sonnet`.

### 7.6 Naming & output filenames
Discipline names are the node ids in §4.2. Output filename realignment vs reveng:
`behaviour-extraction → output/behaviour-analysis.md` (was `application-analysis.md`);
`schema-extraction → output/schema-analysis.md` (was `database-analysis.md`). `domain-analysis.md`
and `interaction-analysis.md` are unchanged. `PRD.md`, `feature-plan.md`, and `output/features/FT-*.md`
keep their names. Gitignore the regeneratable intermediates (`output/html/`,
`output/transcripts/*_curated.txt`) as reveng does.

## 8. Package Layout & Supporting Files

Mirror archon-ralph's structure and [`bin/cli.ts`](https://github.com/marc0der/archon-ralph/blob/HEAD/bin/cli.ts)
behaviour exactly.

```
archon-reveng/
├── bin/cli.ts                 # `archon-reveng init [--force] [--dir <path>]`
├── package.json               # name, bin, files:[bin,template], engines.bun, type:module
├── shell.nix                  # mmdc + headless Chromium (PUPPETEER_EXECUTABLE_PATH) + bun/node
├── README.md                  # install (bunx … init), requirements (Archon fork), run, layout
└── template/
    ├── config.yaml            # project-scoped Archon config stub (copy ralph's shape)
    ├── package.json           # Bun project for the scripts (copy ralph's)
    ├── tsconfig.json
    ├── workflows/reveng.yaml
    ├── commands/<10 files>.md  # §6
    └── scripts/reveng-*.ts     # §7.1–7.4
```

- **`bin/cli.ts`** — copy archon-ralph's installer; rename the tool to `archon-reveng`; copy
  `template/` into `<dir>/.archon/`, skipping existing files unless `--force`. Same flags
  (`--force/-f`, `--dir`, `--help/-h`). Additionally (mirroring `reveng init`): scaffold the
  workspace input/output dirs (`screenshots/`, `transcripts/`, `src/`, `output/`) and append the
  §7.6 intermediates to `.gitignore`, skipping anything that already exists.
- **`template/workflows/reveng.yaml`** — top-level: `name: reveng`, `provider: claude`,
  `model: opus`, `interactive: true`, `worktree: { enabled: false }`. Nodes per §4.2/§5.
  Loops: `until: ALL_CURATED` (schema-required sentinel — the command emits it only when no
  unprocessed file remains), `fresh_context: true`, `max_iterations: 1000` (safety ceiling), and
  `until_bash` calling the §7.2/§7.3 cap scripts via `bun run .archon/scripts/<name>.ts` (the
  authoritative stop).
- **`README.md`** — the front door for anyone picking up the project; mirror
  [archon-ralph's README](https://github.com/marc0der/archon-ralph/blob/HEAD/README.md) and cover:
  - **What it is** — one-paragraph purpose + the HITL-DAG mental model.
  - **Requirements** — the [marc0der/Archon](https://github.com/marc0der/Archon) **fork** (and why),
    Bun, Claude Code, and (optional) `mmdc` + headless Chromium for diagram validation.
  - **Install** — `bunx github:marc0der/archon-reveng init` and what it scaffolds (`.archon/` +
    the workspace input/output dirs + `.gitignore`).
  - **Inputs** — the three required dirs (`screenshots/`, `transcripts/`, `src/`) and what each holds.
  - **Run** — `archon workflow run reveng`, foreground (no `--detach`).
  - **Resolving the two gates** (the distinctive feature) — find the paused run with
    `archon workflow runs` / `status`, then
    `archon workflow approve | reject "<feedback>" | abandon <run-id>`; explain branch 1
    (reject → regenerate) vs branch 2 (abandon → add interviews → re-run).
  - **Outputs** — what lands in `output/`, committed vs gitignored.
  - **Troubleshooting** — `mmdc`/Chromium setup (or just `nix-shell`); one run per workspace.
  - **For maintainers** — how `template/` is vendored into `.archon/`, and how to iterate (edit
    `template/`, re-run `init --force`).
- **`shell.nix`** — provides `mmdc` (mermaid-cli) **with a headless Chromium** and exports
  `PUPPETEER_EXECUTABLE_PATH`, plus Bun/Node for the scripts and tests. Document `nix-shell` as the
  one-step way to enable diagram validation; the manual path is `npm i -g @mermaid-js/mermaid-cli`
  **plus** a system Chromium.

## 9. Models

Workflow-level `model: opus`; the two loops inherit it (loops ignore per-node `model:`),
matching reveng's all-opus defaults (Opus vision quality matters for `screen-reconstruction`).
Only `report` is overridden to `sonnet`. All command nodes are otherwise `opus`.

## 10. Resolved Decisions

These close the questions left open in earlier drafts; the build should not re-open them.

1. **Command files are vendored copies** of reveng prompts (no source-sync step in v1) — matches
   archon-ralph. A `bin/sync` is explicitly out of scope.
2. **`requirements-synthesis` is the heaviest port** — the product-manager prompt's
   orchestration (prerequisite checks, analyst-spawning, the `validate-mermaid` step) is
   **removed**; the DAG guarantees the four analyses exist and a separate node validates
   mermaid. It keeps only read-four-analyses → synthesise → write PRD (with its Open Questions
   section). See §6.
3. **The `archon workflow run` message argument is an optional free-text run label** with no
   semantic use; do not require or parse it.
4. **No second mermaid pass** over feature specs in v1.
5. **Loop ceiling is a fixed `max_iterations: 1000`** (safety stop above any realistic file
   count), not derived from the file count.
6. **`worktree.enabled: false`** ⇒ live checkout; only one run per workspace at a time. Editing
   deliverables in place during a pause is the intended review UX.
7. **Loops carry a sentinel `until:`** (schema-required) alongside the authoritative `until_bash`
   cap; control scripts are argument-free and cwd-relative.
8. **`archon-reveng init` scaffolds the workspace** (`screenshots/`, `transcripts/`, `src/`,
   `output/`) and `.gitignore`, mirroring `reveng init` — not just the `.archon/` tree.
9. **Validation uses the fork's `archon validate` CLI**, not direct imports of Archon internals.
10. **`mmdc` needs a headless Chromium**; the validator self-probes and reports `skipped` (not
    false `invalid`) when the tool or Chromium is unusable. `shell.nix` bundles Chromium.

## 11. Testing & Definition of Done

**Testing seams** (the package introduces the first test seam; archon-ralph ships untested):

- **Script unit tests** — `template/scripts/*.test.ts` (bun test), each driving a temp
  directory tree: `reveng-precondition` (missing/empty vs populated inputs), the two cap
  counters (skip-if-done "done"/"continue", empty-dir vacuous-done), `reveng-mermaid-validate`
  (`mmdc` absent → skipped; present+broken → reports failure; present+valid → ok). Assert
  observable behaviour (exit code + stdout status), not internals. Prior art:
  [`archon-ralph/template/scripts/ralph-*-cap.ts`](https://github.com/marc0der/archon-ralph/tree/HEAD/template/scripts).
- **Workflow + command validation** — the fork ships a validator CLI (no need to import engine
  internals): `archon validate workflows reveng` (graph resolves — unique ids, valid
  `depends_on`, no cycles, both `approval` nodes well-formed, loops carry `until`) and
  `archon validate commands` (every `command:` / `loop.command:` resolves to a file). Source
  form: `bun run cli validate …`. **Build prerequisite:** the `marc0der/Archon` fork must be
  installed/available (it also runs the workflow).

**Definition of done:**
- [ ] Every file in §8 exists; `bunx … init` copies `template/` into a project's `.archon/`
      (skip-existing; `--force` overwrites).
- [ ] All ten command files are present and reflect their §6 deltas.
- [ ] `reveng.yaml` matches §4/§5/§9 and passes `archon validate workflows reveng`; all command files pass `archon validate commands`.
- [ ] The four control scripts behave per §7 and their unit tests pass.
- [ ] README covers requirements (fork + `mmdc`/Chromium), install/scaffold, inputs, run,
      **resolving the two gates** (approve/reject/abandon), and outputs; `shell.nix` provides
      `mmdc` + Chromium and the scripts/tests toolchain.
- [ ] No live end-to-end Claude run is required to consider the build complete.

## 12. Out of Scope

Changes to the reveng bash CLI; a data-driven input/curator/analyst registry; an archive phase;
mid-workflow back-edges (branch 2 is abandon+re-run); renaming `PRD.md`/`FT-*.md`; reinstating
the claude.ai Mermaid connector; a command-file sync step; a gate-semantics integration harness
(approve/reject/abandon is the engine's behaviour, not this package's).
