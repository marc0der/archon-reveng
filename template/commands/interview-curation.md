---
description: Loop body — curate the first uncurated stakeholder transcript under transcripts/ (sorted, excluding *_curated.txt) into output/transcripts/<name>_curated.txt by mechanically removing off-topic passages, one per fresh iteration; emit ALL_CURATED when none remain.
argument-hint: (no arguments — reads transcripts/, writes one output/transcripts/<name>_curated.txt, emits ALL_CURATED when done)
---

# Interview Curation

You curate a stakeholder interview transcript by removing off-topic passages. Your job is to remove
off-topic content while preserving the application walkthrough and domain knowledge **verbatim**. All
kept text is preserved mechanically — you never write or rewrite any transcript content.

Use British English in all output.

## Loop-body contract

You are **one fresh iteration of a loop**. You hold no memory of previous iterations — the only
state is the filesystem. Each time you run you curate **exactly one** transcript, then stop. The
loop re-invokes you with a clean context until every transcript has been curated.

- Curate **only the first** uncurated transcript in sorted order. Never batch.
- When no uncurated transcript remains, emit the sentinel and write nothing.

## Step 1 — Find the work

List the **top-level** `*.txt` files directly under `transcripts/` (do not recurse into
sub-directories), **excluding** any whose name ends in `_curated.txt` (a curated artefact is never
itself an input to curate):

```
ls transcripts/
```

A transcript is **already curated** when `output/transcripts/<name>_curated.txt` exists, where
`<name>` is the transcript's basename with its `.txt` extension removed (for example
`transcripts/interview-1.txt` → `output/transcripts/interview-1_curated.txt`).

Build the list of transcripts that have **no** corresponding
`output/transcripts/<name>_curated.txt`, then **sort it ascending by filename** and keep the
**first** entry only.

**If that list is empty** (every transcript already has its curated copy, or `transcripts/` is
empty), output exactly the following line and nothing else, then stop — this is the loop's stop
sentinel:

```
ALL_CURATED
```

Otherwise continue with the single selected transcript.

## Step 2 — Derive the output path

Take the selected transcript's filename, replace the `.txt` extension with `_curated.txt`, and place
it under `output/transcripts/`. For example:

- `transcripts/interview-1.txt` → `output/transcripts/interview-1_curated.txt`
- `transcripts/deep-dive.txt` → `output/transcripts/deep-dive_curated.txt`

## Step 3 — Ensure the output directory exists

```
mkdir -p output/transcripts
```

## Step 4 — Copy the original file

Copy the original transcript to the output path using `cp`. This creates an exact mechanical copy
that preserves all text verbatim:

```
cp <transcript-path> <output-path>
```

## Step 5 — Read the output file

Read the output file using the Read tool, so that subsequent edits operate on the copy and never
touch the original input.

## Step 6 — Identify passages to remove

Classify content into two categories:

**Keep** — content directly about the application or its domain:

- Application walkthrough content: screen descriptions, user flows, functionality explanations, how
  the system behaves
- Domain knowledge: business rules, terminology, processes, regulations that the application
  implements
- Technical details about the application: architecture, data flows, infrastructure it runs on
- Integrations and dependencies: third-party systems, external services, APIs, data exchanges,
  upstream/downstream applications the system connects to

**Remove** — everything else, including but not limited to:

- The incumbent modernisation team's agenda, plans, opinions, or approach discussions
- Stakeholder feature requests or wishlists for new functionality
- Project management discussions: team structure, suppliers, contracts, timelines, staffing,
  resourcing, delivery plans
- Meeting logistics and scheduling: arranging follow-ups, calendar availability, session housekeeping
- Personal context about individuals: career history, background, role introductions beyond job title
- Technical tangents unrelated to the application itself: DPIA processes, data protection policy,
  procurement procedures, programme governance
- Social pleasantries, small talk, greetings, sign-offs, thanks, and chitchat
- Meta-discussion about the interview process itself
- Tangential conversation not related to the current application or its domain

**When in doubt, remove** — but never remove content that describes how the application behaves, what
it connects to, or what domain rules it implements. These transcripts are typically recordings of
sessions where third-party vendors explored legacy applications as part of a migration engagement.
We are not interested in the vendors' migration plans, modernisation approach, or opinions — only the
as-is state of the application they were examining. The test is: does this passage describe what the
application does today, or what someone planned to do with it? Keep the former, remove the latter.

## Step 7 — Remove each identified passage

Remove each identified passage using the Edit tool on the **output file** (never the original input).
For each passage:

- Set `old_string` to the **exact text** of the passage to remove (copy it precisely, including
  whitespace, timestamps and line breaks)
- Set `new_string` to an empty string `""`
- If removing a passage leaves adjacent blank lines, make a follow-up Edit to collapse them to a
  single blank line

## Step 8 — Confirm

Return a confirmation message containing:

- The output file path
- A brief summary of what categories of content were removed, with approximate counts (e.g.
  "Removed: 3 passages discussing the incumbent team's migration timeline, 2 feature requests for a
  new reporting dashboard")
- If nothing was removed, state that the transcript contained no off-topic material
