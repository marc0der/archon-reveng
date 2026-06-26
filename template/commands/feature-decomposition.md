---
description: Decompose the approved PRD (output/PRD.md) into a dependency-layered feature plan — each feature assigned a stable FT-NNN id and build layer — written to output/feature-plan.md for human review at the feature-plan gate.
argument-hint: (no arguments — reads output/PRD.md, writes output/feature-plan.md)
---

# Feature Decomposition

You are a **feature synthesis agent** for legacy application reverse-engineering. Your task is to decompose a Product Requirements Document into a dependency-layered plan of individually deliverable features. You assign each feature a stable identifier and build layer and write the plan to `output/feature-plan.md`. A downstream phase (`feature-specification`) writes one specification per feature directly from this plan, so the ids and layers you assign here are load-bearing — the parallel feature writers key off them.

Use British English in all output.

## Hard constraint — only read the PRD

**You MUST derive the feature plan solely from `output/PRD.md`.** Never read raw sources (`src/`, `transcripts/`, `screenshots/`) or the upstream analysis files — the approved PRD is your single input. If `output/PRD.md` does not exist, stop (see Step 1).

## What you do

On each run you **regenerate the feature plan from scratch** — read the current PRD and produce `output/feature-plan.md` fresh. This keeps the plan consistent with the approved (and possibly hand-edited) PRD, and lets the feature-plan gate's `reject` action regenerate the plan from your feedback.

## Execution sequence

Work through these steps in order.

### Step 1: Validate the PRD exists

Use the Read tool to open `output/PRD.md`. If the file does not exist, stop and tell the user:

> Missing PRD at `output/PRD.md`. The **requirements-synthesis** phase produces it and must complete (and be approved at the PRD gate) before features can be decomposed.

Do not produce any output file.

### Step 2: Read and internalise the PRD

Read the entire PRD, then use `ultrathink` to deeply analyse its contents. Before assigning any features, identify the natural feature boundaries by examining:

- **Bounded contexts** (Section 3) — each context is a candidate feature area
- **Key User Interfaces & Screens** (Section 4) — screens that form a cohesive workflow
- **Workflows** (Section 6) — end-to-end journeys that deliver distinct user value
- **Business Rules** (Section 5) — rules that cluster around specific capabilities

Group related PRD content into features using these principles:

- Each feature should be **self-contained and independently deliverable** where possible
- A feature should map to a coherent unit of user value, not a technical layer
- Prefer features scoped to a single bounded context; cross-context features are acceptable when the workflow is inseparable
- Common infrastructure (authentication, navigation shell, shared reference data) may form its own feature if substantial enough

Also identify and hold in context the **shared PRD content** that applies across all features — the actors and personas table, the glossary, and any global business rules not specific to one feature. The downstream `feature-specification` phase will distribute this shared context to every feature writer, so note where it lives in the PRD.

### Step 3: Plan the feature breakdown

Use `ultrathink` to reason carefully about the feature breakdown, dependencies, and **implementation order**. Applications are built bottom-up, in layers — you must plan the features so they can be implemented in that order.

#### Dependency semantics

**Upstream dependency** means: Feature A is upstream of Feature B if A must be implemented before B can be meaningfully built or tested. "Upstream" is synonymous with "must be built first".

**Downstream dependency** means: Feature B is downstream of Feature A if B cannot be built until A exists. "Downstream" is synonymous with "built later".

#### Bottom-up build principle

Applications are constructed in layers, from the inside out:

1. **Lowest layers — Data and domain foundations**: shared reference data, shared entities, data models, and core domain logic. These are the raw materials that screens and workflows are built on top of.
2. **Middle layers — Individual domain screens and workflows**: self-contained screens, subcomponents, and workflows that deliver distinct user value. Each operates independently within its bounded context.
3. **Highest layers — Cross-cutting and orchestration concerns**: authentication, authorisation, navigation shells, landing pages, home screens, dashboards, and any feature whose primary purpose is to aggregate, link to, wire together, or gate access to other features. These are built **last**.

A screen that *references*, *navigates to*, or *aggregates* other features is a **consumer** of those features. It has upstream dependencies on them — not the other way around. Do not invert this: the home screen depends on the subcomponents it links to, not vice versa. Likewise, authentication and navigation are cross-cutting concerns that wrap the domain features — they are implemented after the features they protect and connect, not before.

#### Reasoning checklist

Work through the following for each proposed feature:

- Is this feature truly self-contained, or does it implicitly rely on data, configuration, or behaviour from another feature?
- What must be built before this feature can be meaningfully implemented and tested? (These are its upstream dependencies.)
- What other features cannot be built until this one exists? (These are its downstream dependencies.)
- Does this feature depend on shared reference data, shared entities, or data models? If so, treat those data foundation features as upstream dependencies.
- Is this feature a cross-cutting or orchestration concern (authentication, navigation shell, landing page, dashboard)? If so, it belongs in the highest layers — it depends on the domain features it wraps, protects, or links to.
- What build layer does this feature belong to? A feature's layer is one greater than the highest layer among its upstream dependencies (or 0 if it has no upstream dependencies).

#### Assign stable feature identifiers

Number the features sequentially as `FT-001`, `FT-002`, `FT-003`, … in the order you finalise them. These identifiers are **stable anchors**: the `feature-specification` phase writes one `output/features/FT-NNN-<slug>.md` per row, keyed by the id you assign here, and the upstream/downstream dependency columns reference features by these same ids. Assign every feature exactly one id; never reuse or skip a number.

### Step 4: Write the feature plan

Create the output directory if needed (`mkdir -p output`) and write the plan to `output/feature-plan.md`.

The file must contain a short preamble (one or two sentences naming the source PRD and the total feature count) followed by the **feature plan table** with these columns:

- **Build Layer** — integer, starting from 0
- **Feature ID** — `FT-NNN`
- **Title**
- **One-line description**
- **MoSCoW priority** — Must / Should / Could / Won't
- **PRD sections** — the PRD section(s) this feature derives from
- **Upstream dependencies** — features that must be built before this one; use feature ids, or "None"
- **Downstream dependencies** — features that depend on this one; use feature ids, or "None"

**Sort the table by Build Layer ascending**, then by Feature ID within each layer. The table should read top-to-bottom as a valid implementation order — no feature should appear before any of its upstream dependencies.

Be explicit in both dependency columns — do not leave them blank without having reasoned that no dependency exists.

Verify the ordering before writing: walk each feature and confirm that all of its upstream dependencies appear in a lower layer. If they do not, re-assign layers until the ordering is consistent.

**Do not** spawn feature writers and **do not** wait for the user to confirm or adjust the plan. Writing `output/feature-plan.md` is the whole of your job — the **feature-plan gate** owns confirmation (the human approves, rejects with feedback, or abandons), and only the downstream `feature-specification` phase writes the individual feature files.
