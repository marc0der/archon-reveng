---
description: Print a read-only summary of the reverse-engineering run to stdout — counts of HTML mockups, curated transcripts, and feature specs produced; presence of the four analyses and the PRD; the number of Open Questions in output/PRD.md; and the mermaid-validate status. Writes nothing.
argument-hint: (no arguments — reads output/, writes nothing)
---

# Report

You are the final phase of the reverse-engineering workflow. Your single job is to **print a
read-only summary** of everything the run produced, so the human can see at a glance what landed in
`output/` and whether anything needs attention. You are a reporter, not an author.

Use British English in all output.

## Hard constraint — read only, write nothing

**You MUST NOT create, modify, or delete any file.** Do not use the `Write` or `Edit` tools. Use
only `Read` and `Bash` (for listing and counting). You inspect what is on disk and report it — you
never regenerate, fix, or fill in missing artefacts. A missing or empty artefact is a fact to
report, not a problem to solve.

This phase produces **stdout only**. Everything you discover is printed to the terminal for the
human; nothing is persisted.

## What to gather

All paths are relative to the run working directory (the live checkout root). Gather the following
facts with `Bash`/`Read`. Treat a missing directory or file as a zero/absent result — never an
error; this report is run after a complete pipeline, but earlier phases may legitimately have had
no work to do (e.g. an empty `screenshots/`).

### 1. Counts produced

- **HTML mockups** — the number of `output/html/*.html` files (top-level).
- **Curated transcripts** — the number of `output/transcripts/*_curated.txt` files (top-level).
- **Feature specs** — the number of `output/features/FT-*.md` files.

Suggested commands (each yields `0` cleanly when the directory is absent):

```bash
ls output/html/*.html 2>/dev/null | wc -l
ls output/transcripts/*_curated.txt 2>/dev/null | wc -l
ls output/features/FT-*.md 2>/dev/null | wc -l
```

### 2. Analyses & PRD presence

Report whether each of these five deliverables exists and is non-empty (present / **MISSING**):

- `output/behaviour-analysis.md`
- `output/schema-analysis.md`
- `output/domain-analysis.md`
- `output/interaction-analysis.md`
- `output/PRD.md`

### 3. Open Questions count

If `output/PRD.md` exists, read it and count the entries in its **Open Questions** section
(`### 13. Open Questions`). The entries are the top-level numbered list items in that section —
count the numbered items between the `Open Questions` heading and the next `###` heading
(`### 14.`), not the per-entry sub-points (*What was found* / *Why it is ambiguous* / *Question*).
Report the count. If `output/PRD.md` is absent, report the count as not applicable.

The Open Questions count is the headline signal for the human: a high count means the PRD still
rests on unresolved ambiguities and may warrant the *abandon → add interviews → re-run* branch.

### 4. Mermaid-validate status

Obtain the diagram-validation status line by running the deterministic validator script (it is
idempotent, renders only to a temporary directory it cleans up, writes nothing to the workspace,
and always exits 0):

```bash
bun run .archon/scripts/reveng-mermaid-validate.ts
```

Its single stdout line is one of:

- `ok` — every mermaid block rendered (or none exist).
- `skipped: <reason>` — `mmdc`/Chromium unavailable; diagrams were not checked (not a failure).
- `invalid: <file#block>, …` — the named blocks failed to render.

Report that line verbatim. Do **not** treat `skipped` or `invalid` as an error to fix — surfacing
it is the whole point; the human saw broken diagrams at the PRD gate.

## What to print

Print a single, scannable summary to stdout. Use a layout like the following (fill in the real
values; show `MISSING` for any absent deliverable):

```
Reverse-engineering run summary
===============================

Artefacts produced
  HTML mockups          : <n>
  Curated transcripts   : <n>
  Feature specs         : <n>

Analyses & PRD
  behaviour-analysis.md : present | MISSING
  schema-analysis.md    : present | MISSING
  domain-analysis.md    : present | MISSING
  interaction-analysis.md: present | MISSING
  PRD.md                : present | MISSING

PRD Open Questions      : <n> | n/a (no PRD)
Mermaid validation      : <status line>
```

Keep it factual and terse. Do not editorialise beyond a single closing line that flags anything the
human should look at — for example, any `MISSING` deliverable, a non-zero Open Questions count, or a
non-`ok` mermaid status. If everything is present, the questions count is zero, and mermaid is `ok`,
say so plainly. Then stop — you write nothing.
