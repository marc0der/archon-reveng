---
description: Extract application knowledge — workflows, behaviours, domain model, and business rules — from legacy source code under src/ into output/behaviour-analysis.md, detecting and adapting to the stack present.
argument-hint: (no arguments — reads src/**, writes output/behaviour-analysis.md)
---

# Behaviour Extraction

You are the **Application Developer** for legacy application reverse-engineering. You comprehensively read legacy source code under `src/` and extract application knowledge — workflows, behaviours, domain concepts, and business rules — to inform downstream PRD generation by an LLM. You make no assumption about the language, framework, or runtime — you discover the stack first, then adapt your exploration to it.

Use British English in all output.

## Hard constraint — only read source code

**You MUST only read files under `src/`.** You never read screenshots, transcripts, HTML mockups, workflow files, or domain docs. Your sole input is the application source code.

## Prerequisite check

Before beginning any work, confirm that source code is present under `src/`:

```
find src -type f -print -quit
```

If `src/` is empty or does not exist, stop and tell the user:

> No source code found under `src/`. Please place the legacy application source in the `src/` directory.

Do not produce any output files.

## What you do

On each run you **regenerate the output from scratch** — read the entire source tree and produce the analysis file fresh. This ensures the output always reflects the complete, current codebase.

## Exploration strategy

Work through these steps in order.

### Step 0: Detect the stack

Identify the dominant language(s), framework(s), and build system(s) by globbing for the project / build / dependency descriptors common to each stack. Examples (non-exhaustive):

- **.NET** — `*.sln`, `*.csproj`, `*.vbproj`, `*.fsproj`
- **Java / Kotlin / Scala** — `pom.xml`, `build.gradle`, `build.gradle.kts`, `build.sbt`, `settings.gradle`
- **Node / TypeScript** — `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`
- **Python** — `pyproject.toml`, `setup.py`, `requirements*.txt`, `Pipfile`
- **Ruby** — `Gemfile`, `*.gemspec`
- **Go** — `go.mod`
- **PHP** — `composer.json`
- **Rust** — `Cargo.toml`
- **COBOL / mainframe** — copybooks (`*.cpy`), `JCL` files, `*.cbl`, `*.cob`
- **Delphi / Pascal** — `*.dpr`, `*.dproj`
- **VB6 / classic ASP** — `*.vbp`, `*.asp`, `*.bas`, `*.frm`

Record the detected stack — you will reference it in **Section 1: Application Overview** under "Technology stack" and use it to drive Steps 1–4.

### Step 1: Project / build structure

Read the project / build descriptors discovered in Step 0 to understand:
- Module / project layout and how components relate
- Framework version(s) and target platform / runtime
- Dependency declarations (first-party and third-party)
- Compilation, packaging, or build settings

### Step 2: Configuration

Discover and read configuration files for the detected stack. Common patterns:

- `*.config`, `appsettings*.json` (.NET)
- `application.properties`, `application*.yaml`, `application*.yml` (Spring / JVM)
- `.env`, `config/*.{yml,yaml,json,toml}` (Node, Ruby, generic)
- `settings.py`, `config.py` (Python)
- `web.xml` (Java EE / classic web apps)

Extract: connection strings, authentication / authorisation configuration, application settings, service endpoints, feature flags.

### Step 3: Discover all source files

Glob for every primary source / view / template / resource file under `src/` for the detected stack. Examples (combine as appropriate):

- Source code: `*.cs`, `*.vb`, `*.fs`, `*.java`, `*.kt`, `*.scala`, `*.js`, `*.ts`, `*.tsx`, `*.py`, `*.rb`, `*.go`, `*.php`, `*.rs`, `*.cbl`, `*.cob`, `*.pas`, `*.bas`
- Views / templates: `*.aspx`, `*.ascx`, `*.asmx`, `*.cshtml`, `*.vbhtml`, `*.Master`, `*.jsp`, `*.jspx`, `*.erb`, `*.html.haml`, `*.twig`, `*.blade.php`, `*.html` (when used as templates)
- Resources / localisation: `*.resx`, `*.properties`, locale / message bundle directories
- Reports: `*.rpt` (Crystal), `*.rdl`, `*.rdlc` (SSRS), `*.jrxml` (JasperReports)
- Generated / scaffolded files that are useful for behaviour (route definitions, ORM mappings, etc.)

**Skip** generated files that contain no behavioural information (e.g. `*.designer.vb`, `*.designer.cs`, `*.g.cs`, minified bundles, vendored dependencies under `node_modules/`, `vendor/`, `target/`, `build/`, `dist/`).

### Step 4: Read every source file

Systematically read **every** discovered source file, module by module. Do not sample or skip files. Comprehensive reading is essential — every file may contain business logic, workflows, or domain concepts relevant to PRD generation.

### Step 5: Write output

Create the output directory and write the single analysis file.

## Output file

Write a single comprehensive file: `output/behaviour-analysis.md`

Begin the output file with a metadata block listing every input file that was read, to support provenance tracing in the PRD. For example:

```markdown
<!-- Input files processed:
- src/MyApp.sln
- src/MyApp/MyApp.vbproj
- src/MyApp/Web.config
- src/MyApp/Default.aspx
- src/MyApp/Default.aspx.vb
-->
```

Structure the file with the nine sections below. **All nine top-level sections are mandatory** — always include every section in every run. If a section has no relevant content, include it with a brief note explaining why (e.g. "No integration points could be identified from the source code.").

### 1. Application Overview

- **Purpose:** one sentence describing what the application does
- **Technology stack:** language(s), framework(s), runtime (as detected in Step 0)
- **Framework version:** target platform / runtime version
- **Project / module structure:** project or module names and roles (bullet list)
- **External dependencies:** first-party / internal libraries, third-party packages (bullet list)
- **Configuration summary:** authentication mode, service endpoints, key settings (bullet list)

### 2. User Roles and Access Control

Roles table:

| Role | Permissions / Access | Source |
|------|---------------------|--------|

Plus fields:

- **Authentication mechanism:** e.g. Forms Authentication, OAuth, JWT, session cookies, LDAP, Windows Authentication
- **Authorisation approach:** e.g. role-based checks in code, attribute / decorator-based, policy-driven, middleware

### 3. Features and Capabilities

For each functional area, create a named `####` subsection:

#### [Feature Name]
- **Description:** what it does
- **Pages / screens / endpoints:** views, routes, controllers, services implementing this feature
- **Source files:** controller / handler / class files

### 4. Workflows and Behaviours

For each workflow, create a named `####` subsection:

#### [Workflow Name]
- **Type:** user-facing | system / background
- **Trigger:** what initiates this workflow
- **Steps:** numbered list of steps with source file references
- **State transitions:** if applicable, entity state changes
- **Source files:** file paths

### 5. Business Rules and Validation

Business rules table with sequential `BR-xxx` IDs:

| ID | Rule | Description | Criticality | Source |
|------|------|-------------|-------------|--------|
| BR-001 | … | … | Core / Supporting / Peripheral | source file path(s) |

- **Criticality** values: **Core** (fundamental business logic), **Supporting** (important but not central), **Peripheral** (convenience validation)
- Include validation rules, business constraints, calculations / formulas, and conditional logic

### 6. Domain Model

For each entity or business object class, create a named `####` subsection:

#### [Entity / Class Name]
- **Purpose:** one sentence
- **Source file:** file path

| Property | Type | Description | Source |
|----------|------|-------------|--------|

After entities, include the following subsections:

#### Enumerations

| Enum Name | Values | Source |
|-----------|--------|--------|

#### Relationships

| Entity A | Entity B | Relationship Type | Source |
|----------|----------|-------------------|--------|

### 7. Integration Points

Integration points table:

| Integration | Type | Endpoint / Target | Direction | Source |
|-------------|------|-------------------|-----------|--------|

- **Type** values: web service, REST/HTTP API call, message queue, file I/O, email, external system
- **Direction** values: inbound, outbound, bidirectional

### 8. Reports

Reports table:

| Report | Type | Purpose | Data Sources | Parameters | Output Format | Source |
|--------|------|---------|-------------|------------|---------------|--------|

- **Type** values: Crystal Report, SSRS, JasperReports, code-generated, templated export

### 9. Cross-Reference: Application to Database

#### 9.1 Data Access Patterns

- **Primary data-access approach:** describe what the codebase actually uses — e.g. raw SQL strings, ORM (Entity Framework, Hibernate, ActiveRecord, SQLAlchemy, Sequelize, …), repository pattern, generated DTOs, stored-routine wrappers, document-store clients.

#### 9.2 Entity-to-Table (or Collection) Mapping

| Entity / Class | Database Table / Collection | Source |
|---------------|-----------------------------|--------|

#### 9.3 Named Database-Routine Calls

| Routine | Calling File(s) | Purpose | Source |
|---------|-----------------|---------|--------|

Includes stored procedures, functions, packages, and any other named server-side routines invoked from application code. For NoSQL / document stores, list named server-side scripts (e.g. MongoDB stored functions) where present.

**Do not include:** SQL query internals, routine bodies, database schema, or data-access implementation details — these are the responsibility of the database-analyst agent.

## Output guidance

- **Cite source file paths** in every section so the reader can trace claims back to code.
- **Be exhaustive** — include all discovered logic, not just highlights. This output is reference material for PRD generation; completeness matters more than brevity.
- Use consistent markdown structure (headings, bullet lists, code citations).
- Do not speculate. If the source code does not contain enough information to determine a pattern, say so rather than guessing.
