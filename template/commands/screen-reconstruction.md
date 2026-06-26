---
description: Loop body — convert the first unprocessed screenshot under screenshots/ (sorted) into a semantic, unstyled HTML mockup at output/html/<name>.html, one per fresh iteration; emit ALL_CURATED when none remain.
argument-hint: (no arguments — reads screenshots/, writes one output/html/<name>.html, emits ALL_CURATED when done)
---

# Screen Reconstruction

You convert a legacy application screenshot into semantic, unstyled mockup HTML. This extracts the
information structure from a screenshot so downstream phases can reason about the UI without paying
expensive image tokens on every read.

Use British English in all output.

## Loop-body contract

You are **one fresh iteration of a loop**. You hold no memory of previous iterations — the only
state is the filesystem. Each time you run you process **exactly one** screenshot, then stop. The
loop re-invokes you with a clean context until every screenshot has been reconstructed.

- Process **only the first** unprocessed screenshot in sorted order. Never batch.
- When no unprocessed screenshot remains, emit the sentinel and write nothing.

## Step 1 — Find the work

List the **top-level** files directly under `screenshots/` (do not recurse into sub-directories)
whose extension is one of `.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp` (matched
case-insensitively):

```
ls screenshots/
```

A screenshot is **already reconstructed** when `output/html/<name>.html` exists, where `<name>` is
the screenshot's basename with its extension removed (for example `screenshots/dashboard.png` →
`output/html/dashboard.html`). The output is **flat** — sub-directory structure is not preserved.

Build the list of screenshots that have **no** corresponding `output/html/<name>.html`, then **sort
it ascending by filename** and keep the **first** entry only.

**If that list is empty** (every screenshot already has its HTML, or `screenshots/` is empty),
output exactly the following line and nothing else, then stop — this is the loop's stop sentinel:

```
ALL_CURATED
```

Otherwise continue with the single selected screenshot.

## Step 2 — Read the image

Read the selected screenshot using the Read tool. The path is relative to the project root.

## Step 3 — Analyse the UI

Analyse the UI shown in the screenshot. Identify all structural elements: headings, navigation,
forms, tables, buttons, lists, sections, and any other meaningful components. Make no assumption
about the application's stack — describe what is on screen, not how it was built.

## Step 4 — Produce semantic HTML

Produce semantic HTML following these rules strictly:

- Use appropriate semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<form>`,
  `<table>`, `<fieldset>`, `<legend>`, `<label>`, `<button>`, `<h1>`–`<h6>`, `<ul>`/`<ol>`,
  `<footer>`, `<aside>`, `<article>`, `<details>`, `<summary>`, etc.
- Do **not** include any `<style>` tags, inline styles, or CSS classes used for visual purposes.
- Use `aria-label` or similar attributes only where they convey meaningful information not already
  present in the text content.
- Preserve all visible text content exactly as shown in the screenshot, **except** for personally
  identifiable information (PII) — replace any real names, email addresses, phone numbers, national
  identifiers, addresses, or other identifying details with realistic fake equivalents (e.g.
  "John Smith" → "Jane Cooper", "john.smith@example.com" → "jane.cooper@example.com"). Keep the
  fake data consistent within a single file (i.e. the same real value always maps to the same fake
  value).
- Represent form fields with appropriate input types (`text`, `email`, `date`, `checkbox`, `radio`,
  `select`, etc.).
- Use `<table>` with `<thead>`, `<tbody>`, `<th>`, and `<td>` for tabular data.
- Add HTML comments to describe non-text visual elements (icons, charts, images, logos) that carry
  meaning — e.g. `<!-- Bar chart showing monthly revenue -->`.
- Wrap the content in a minimal HTML5 document structure (`<!DOCTYPE html>`, `<html lang="en">`,
  `<head>`, `<body>`).
- Set the `<title>` to something descriptive derived from the page content.

## Step 5 — Derive the output path

Derive the output path from the selected screenshot's basename: drop the image extension and write
to `output/html/<name>.html`. For example:

- `screenshots/dashboard.png` → `output/html/dashboard.html`
- `screenshots/login-form.jpg` → `output/html/login-form.html`

## Step 6 — Ensure the output directory exists

```
mkdir -p output/html
```

## Step 7 — Write the mockup

Write the HTML mockup to the derived output path using the Write tool.

## Step 8 — Confirm

Return a single line confirming the output:

```
Wrote <output-path>
```
