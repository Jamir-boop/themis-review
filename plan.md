# Themis Review — AA Control Room code-review tool

## Context

Team exports Automation Anywhere (A360) bots as .zip from Control Room. No good way to review them: dependencies, variable flow, naming-convention compliance, dead message boxes, logging/comment coverage. Themis Review = static site on GitHub Pages. User drops a .zip; everything parsed **client-side** (nothing uploaded/stored). Output: Blender-style node canvas of taskbots with per-variable wire connections, per-taskbot editor drill-down, rule-based findings with score, print-styled PDF report. UI bilingual ES/EN.

## Decisions (user-confirmed)

- Stack: **React + Vite + TypeScript + React Flow (@xyflow/react)**, deployed via GitHub Pages (gh-actions).
- PDF: **print-styled HTML report** (`window.print()` + `@media print` CSS). No jsPDF.
- Language: **ES/EN toggle** (tiny homemade i18n dict, no i18next — ~2 languages, flat keys).
- MessageBox rule: **two distinct findings** — (a) any `messageBox` in bot = blocks unattended runs; (b) messageBox in disabled node / dead branch = dead code.
- Git repo: initialize in `/home/superuser/Documents/themis-review`, `plan.md` at repo root (copy of this plan). No commits beyond what user asks (user policy: commits only on explicit request — **user explicitly asked to start git project**, so `git init` + initial commit is authorized; NO Co-Authored-By trailers per global policy).

## Input format (verified against `.data/*.zip`)

Zip layout: `Automation Anywhere/Bots/<path>/<botFolder>/tasks/<TaskName>` (extensionless JSON files), optional `tasks/<TaskName>Metadata/*.png` (recorder screenshots), `docs/config/*.xml`, `docs/assets/*`, optional root `manifest.json` (dependency scan — **absent in some exports**, so parser scans `tasks/` files directly; manifest used only as supplement).

Taskbot JSON (top-level keys): `nodes`, `packages`, `properties`, `triggers`, `variables`, `workItemTemplateName`.

- `variables[]`: `{name, description, type, readOnly, input, output, defaultValue, subtype?}`
- `nodes[]`: `{uid, commandName, packageName, disabled, attributes[], children?[], branches?[], returnTo?}` — recursive tree (containers: if/else, loop, try/catch/finally, documentation_sequence, step).
- Call edges: `TaskBot/runTask` → `attributes[name="taskbot"].value.taskbotFile.string` = `repository:///Automation%20Anywhere/Bots/...` (URL-encoded) + `taskbotInput.dictionary[]` = input var mappings (key = callee var, value.expression like `$pDictConfig$` = caller var). Output mapping: check for `assignmentToVariables`-style attribute at parse time (not present in samples' first runTask; handle if found, else omit).
- Comments: `betterComments/BetterComments`, `Comment/Comment`, `A360BotFramework/documentation_comment`, `documentation_about`, `documentation_sequence`.
- Logs: `A360BotFramework/log_message` (also count `LogToFile/logToFile` separately as informational).
- Message boxes: `MessageBox/messageBox`.

## Naming convention (from `guia_implementacion_core_framework.html#variables-y-descripciones`)

Pattern: `<scope><Type><CamelName>`

- scope: `p` local, `i` input, `o` output, `io` in+out, `c` constant
- Type: `Str Num Table Dict List Date Bool File Rec Win Any`
- Rules the linter enforces:
  1. Name matches regex `^(p|i|o|io|c)(Str|Num|Table|Dict|List|Date|Bool|File|Rec|Win|Any)[A-Z][A-Za-z0-9]*$`
  2. Scope prefix consistent with `input`/`output` flags (`i`↔input-only, `o`↔output-only, `io`↔both, `p`/`c`↔neither)
  3. Type token consistent with declared `type` (STRING→Str, NUMBER→Num, DICTIONARY→Dict, LIST→List, DATETIME→Date, BOOLEAN→Bool, FILE→File, TABLE→Table, RECORD→Rec, WINDOW→Win, ANY→Any)
  4. Non-empty `description` on every variable
  5. Booleans named with `Is|Has|Can|Allows|Supports` after type token (warning severity)

## Architecture

```
src/
  core/            # pure TS, zero React — the analysis engine (unit-testable in node)
    zip.ts         # fflate unzip → file map
    parse.ts       # taskbot JSON → TaskbotModel (flatten node tree w/ depth, line numbers)
    model.ts       # types: Project, Taskbot, Action, Variable, CallEdge, VarWire
    graph.ts       # build call graph + per-variable wires + missing-dependency detection
    metrics.ts     # per-taskbot: total lines, disabled lines, comments by kind, log_message count, vars in/out/local, packages
    rules/         # one file per rule, common Finding interface {id, severity, botPath, line?, varName?, messageKey, params, fixKey}
      naming.ts        # rules 1–5 above
      messagebox.ts    # MB-1 blocks-unattended, MB-2 unreachable/disabled
      structure.ts     # empty catch, try without catch/finally, disabled code blocks, hardcoded local paths (C:\/F:\ outside config XML), missing error handling, deep nesting
      hygiene.ts       # comment ratio too low, zero log_message, unused variables (declared, never referenced in any attribute expression), undefined vars passed to runTask, runTask target missing from zip
    score.ts       # 0–100: start 100, weighted deductions per finding severity (error −4, warn −1.5, info −0.5), floor 0, capped per-category so one rule class can't nuke everything; grade bands A≥90 B≥75 C≥60 D≥40 F
  ui/
    App.tsx, DropZone (drag&drop zip, multiple zips OK), state via plain useState/context (no redux)
    canvas/        # React Flow: TaskbotNode custom node (name, stats badges, var handles left=inputs right=outputs), edges: call edges (thick) + var wires (thin, colored by var type, Blender-look bezier), elkjs layered auto-layout, minimap, legend
    editor/        # click node → drawer/route: taskbot “editor style” view — indented action list w/ line numbers, disabled dimmed, comments styled per kind, findings inline as gutter markers, package/version list
    report/        # score card, findings grouped by taskbot → severity, each with explanation + suggested fix (i18n keys), print CSS → PDF
    i18n.ts        # {es, en} flat dicts, useLang() context, toggle in header
.data/             # stays as local fixtures (gitignored? NO — keep out of repo: contains client bot code → add .data/ to .gitignore)
tests/             # vitest on core/ using fixture zips from .data (paths read from disk, never committed)
plan.md
.github/workflows/deploy.yml   # build + deploy to Pages
```

Key design points:

- **Line numbers**: AA editor numbers actions sequentially over the flattened tree (containers count as a line, children follow). Flatten with `lineNo` assigned in traversal order — matches what reviewer sees in Control Room.
- **Variable reference scan**: walk every attribute value recursively; regex `\$([A-Za-z][A-Za-z0-9_]*)(\{|\$)` over `expression`/`string` fields to find var usages → powers unused-var rule and var-wire tooltips.
- **Dead-code / “never open” detection**: reachable = not `disabled` and no disabled ancestor. (Static reachability beyond disabled flags — e.g. `if false` — out of scope v1; note in plan as future.)
- **Multiple zips**: merging several uploads into one project view supported from day 1 (map keyed by repository path) — cheap now, painful later; cross-zip runTask targets resolve naturally.
- **Missing dependency**: runTask target path not present in uploaded zip(s) → ghost node (dashed) + finding (info).

## Score & report

- Score per taskbot + aggregate project score (weighted by line count).
- Report page: project summary table, canvas snapshot optional (skip v1 — print canvas is flaky; report is text/tables), per-taskbot section: metrics, findings each with: rule id, severity, line, explanation, **suggested fix** (concrete: e.g. rename `vStatus` → `pStrStatus`; replace messageBox line 42 with `log_message` + throw).
- Export = "Exportar PDF" button → print dialog. `@media print`: hide nav, page-break per taskbot section, footer with score + date.

## Rule severities (initial)

| Rule | Sev |
|---|---|
| MessageBox in flow (MB-1) | error |
| Var passed to runTask but undefined in callee / caller | error |
| Empty catch | error |
| runTask target missing (MB across zips) | info |
| Naming regex violation / scope-flag mismatch / type mismatch | warn |
| Missing variable description | warn |
| MessageBox unreachable (MB-2 dead code) | warn |
| Disabled code blocks left in bot | info |
| Zero log_message in taskbot | warn |
| Comment ratio < 10% of lines | info |
| Hardcoded absolute path in attribute | warn |
| Unused variable | info |
| Bool naming (Is/Has/Can…) | info |

Thresholds/weights live in one `score.ts` constant block — tune later with real reviews.

## Phases & parallel workstreams

**Phase 0 — scaffold (serial, blocks everything)**
`git init`, Vite React-TS scaffold, deps (`@xyflow/react`, `fflate`, `elkjs`, `vitest`), `.gitignore` (+`.data/`), plan.md, Pages workflow. Initial commit.

Then **3 independent tracks** (can be worked simultaneously / parallel sessions):

- **Track A — core engine** (no UI dep): zip.ts, parse.ts, model.ts, graph.ts, metrics.ts, rules/*, score.ts + vitest tests against `.data` fixtures. Deliverable: `analyze(zipBytes[]) → ProjectAnalysis` JSON.
- **Track B — canvas + editor UI**: React Flow custom nodes, layout, var wires, editor drawer. Starts against a mocked `ProjectAnalysis` fixture (generated once by early Track A parse of Framework.zip), swaps to real engine on merge.
- **Track C — report + i18n + shell**: DropZone, header/lang toggle, report page, print CSS, score card. Also mock-driven.

**Phase 2 — integration (serial)**: wire real engine into B/C, run all 4 example zips, fix parse gaps (e.g. Recorder/capture attribute shapes), verify PDF, deploy to Pages.

## Verification

1. `vitest` — core engine: for each `.data` zip assert taskbot count, runTask edge list, known metric values (e.g. Framework master: 6 runTask, 19 BetterComments), naming findings on known-bad vars, MB findings (`utilidad_mensajeria` has 1 messageBox).
2. `npm run dev` + browser (in-app Browser pane): drop each example zip, check canvas renders all bots + ghost nodes, var wires match `taskbotInput` dicts, editor view line numbers vs Control Room screenshot sanity, language toggle, print preview of report.
3. `npm run build && preview` — confirm static build works offline (no network calls — privacy requirement).
4. Pages deploy on push to main (user pushes when ready).
