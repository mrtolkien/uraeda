# Discovery, round 01: Web UI for the workflow files

## Summary

A web UI for a spec workflow has four parts: an overview of what waits on whom, a reader for each
workflow file, forms for the human's actions (answering questions, reviewing with comments,
approving), and a way to write those actions back. Established tools differ most on how questions
are asked (one at a time in Spec Kit, up to four per call in Claude Code), and on where review
comments attach: GitHub only allows them on source lines, Notion on blocks.

The [proposal](proposal.md) asks for the reader and the human actions, rendered with the structure
of the files (question cards, options with their pros and cons, user stories over their scenarios),
on an iPhone over Tailscale, built with React, Astryx, fate, and the Rust core, and started with
`vp dev` at the repository root.

The code has the human actions in the Rust core, used by `ura`, but the server reaches only a
temporary status reader. The core's parsers keep line numbers but not the structure the proposal
wants to render: option texts, pros and cons, user stories, plan checkboxes. Three things are in the
way: the [stack decision](../decisions/stack.md) requires a server reachable only from 127.0.0.1,
which a phone over Tailscale is not; `ura answer` and `ura review` switch the checkout to the
feature's branch, which would switch the branch under the running server; and features merged into
the default branch are left out of the core's model, so the finished features would not show.

## How other products do it

### Claude Code's question tool

- Each call asks 1 to 4 questions, each with a 12-character header and 2 to 4 options, each option a
  label and a description, with an optional markdown or HTML preview, and a `multiSelect` flag
  ([Agent SDK, user input](https://code.claude.com/docs/en/agent-sdk/user-input)).
- The client must add an "Other" choice taking free text, which becomes the answer; a `response`
  field takes a reply to no question in particular (same source).
- A pending question can wait indefinitely, and a `defer` hook lets the process exit and resume
  later (same source).
- Users complain about the 4-option cap and about option texts and previews cut off without
  scrolling (issue mirrors, read as search snippets only:
  [4 options](https://claudeissues.com/issue/12420-bug-askuserquestion-tool-limited-to-4-options-is-too-restrictive),
  [cut-off descriptions](https://claudeissues.com/issue/39867-askuserquestion-options-with-long-descriptions-get-visually-cut-off-in-terminal),
  [no word wrap](https://claudeissues.com/issue/67113-askuserquestion-ui-long-question-option-text-is-cut-off-with-no-word-wrap-unread)).
- Third-party clones show one tab per question, then a "Review" tab with every answer before
  submitting (snippet only: [pi-askuserquestion](https://github.com/ghoseb/pi-askuserquestion)).

### Spec Kit

- `/clarify` asks at most 5 questions, "EXACTLY ONE question at a time", and never shows the queued
  ones in advance
  ([clarify.md](https://github.com/github/spec-kit/blob/main/templates/commands/clarify.md)).
- A multiple-choice question shows `**Recommended:** Option [X] - <reasoning>` first, then a table
  of 2 to 5 options, with an optional short free answer. Replies are a letter, "yes" for the
  recommendation, or the user's own words (same source).
- Each answer is written into the spec at once, under `## Clarifications` (same source).

### Kiro, Jules, and Cursor

- Kiro writes `requirements.md`, `design.md`, and `tasks.md`, with explicit approval checkpoints;
  review is editing the file or chatting. `tasks.md` shows each task's live status
  ([Kiro specs](https://kiro.dev/docs/specs/),
  [feature specs](https://kiro.dev/docs/specs/feature-specs/)).
- Jules shows a plan as a description, expandable steps, and its assumptions, approved with
  **approve plan**; changes go through chat, and the plan is approved on a timer if the user leaves
  ([review the plan](https://jules.google/docs/review-plan/)).
- Cursor's plan mode asks clarifying questions, then writes a plan the user edits in chat or as a
  markdown file saved in the workspace ([planning](https://cursor.com/docs/agent/planning)).

### GitHub and GitLab reviews

- GitHub renders prose files as a rich diff, but comments "can only be added to files within the
  _source_ view, on a line-by-line basis"
  ([non-code files](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files)).
- A multi-line comment is a click on the first line number and a shift-click on the last
  ([commenting](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/commenting-on-a-pull-request)).
- Review comments stay pending, visible only to their author, until the review is submitted as
  **Comment**, **Approve**, or **Request changes**; a **Viewed** checkbox per file feeds a progress
  bar, and is unchecked when the file changes
  ([reviewing](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request)).
- Browser extensions add comments on rendered markdown by mapping a block back to its source line,
  which their listings call heuristic (snippet only:
  [Marginalia](https://addons.mozilla.org/addon/marginalia-gh/)).
- GitHub Mobile allows comments on unchanged lines since February 2026
  ([changelog](https://github.blog/changelog/2026-02-03-github-mobile-comment-on-unchanged-lines-in-pull-request-files)).
- GitLab has the same pending review, submitted as Approve, Comment, or Request changes; a discarded
  review cannot be restored
  ([GitLab reviews](https://docs.gitlab.com/user/project/merge_requests/reviews/)).

### Google Docs and Notion comments

- On an iPhone, Google Docs comments start from a text selection: select, tap "Add Comment", type,
  confirm
  ([Google Docs help](https://support.google.com/docs/answer/65129?co=GENIE.Platform%3DiOS)).
- Notion comments attach to the page, to selected text, or to a block, through the block's handle
  ([Notion help](https://www.notion.com/help/comments-mentions-and-reminders)).

### Backlog.md

- `backlog browser` serves a local web UI with a kanban board, form editing, an acceptance criteria
  editor, and real-time updates synced with the markdown files
  ([README](https://github.com/MrLesk/Backlog.md)).
- It listens on 127.0.0.1 only, and "is not reachable from other devices on the LAN or VPN" (same
  source). It documents no handling of conflicting edits.

### Obsidian

- Callouts use `> [!type]`, case-insensitive; text after the type is a title; `+` or `-` makes them
  foldable, and an unknown type renders as `note` ([callouts](https://obsidian.md/help/callouts)).
- On mobile, sidebars are collapsed and open with a swipe (snippet only:
  [mobile](https://obsidian.md/help/mobile)).

### Linear and GitHub Projects

- Linear's My Issues groups assigned issues "in a focus order": urgent, blockers, current cycle,
  then the rest ([My Issues](https://linear.app/docs/my-issues)); its inbox is split into Priority
  and Other ([Inbox](https://linear.app/docs/inbox)).
- GitHub Projects boards take their columns from a field; dragging a card changes the field
  ([board layout](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout)).

### What they have in common

Capabilities users of these products may expect, whether or not the proposal mentions them:

- A first screen of what waits on the user, grouped by what they must do
- Questions with a recommended option, the other options, and free text on top
- A way to see every answer before submitting, and answers kept while unsubmitted
- Review comments kept pending, then submitted with a verdict
- Comments anchored to source lines, or to the blocks of a rendered document
- A per-file "viewed" mark that resets when the file changes
- Live updates when the files change elsewhere
- Long texts that wrap, never cut off

## Standards and libraries

### Astryx

Astryx is `@astryxdesign/core` 0.6.7, pinned in
[`packages/web/package.json`](/packages/web/package.json). Its documentation ships as
`src/<Component>/*.doc.mjs` files in the package; the package has no docs folder, and its `docs.mjs`
points to `npx @astryxdesign/cli component <Name>`.

- **App shell**: `AppShell` takes `topNav`, `sideNav`, `mobileNav`, and `banner`; below a
  breakpoint, `md` (768 px) by default, it turns the side navigation into a `MobileNav` drawer, and
  `useAppShellMobile()` closes it after a navigation (`AppShell.doc.mjs`).
- **Navigation**: `SideNav`, `MobileNav`, `TopNav`, `TabList`, `Breadcrumbs`, `Outline` (a table of
  contents), `Stepper`.
- **Choices**: `RadioList` items take a React node as label and description, so an option can carry
  its pros and cons; `SelectableCard` toggles with an accent border, its selection state managed by
  the caller; `SegmentedControl` and `ToggleButtonGroup` suit a few short choices.
- **Text input**: `TextArea` has `rows`, `maxLength`, `status`, but no automatic growth: its source
  only sets `resize: vertical` (`TextArea.tsx:114`). On iOS, text fields floor their font at 16 px,
  so focusing them does not zoom the page (`inputFontFloor.test.ts`).
- **Containers and feedback**: `Card` (whose docs warn "Cards are NOT the default layout tool"),
  `Collapsible` and `CollapsibleGroup`, `Banner` with `info`, `warning`, `error`, `success`,
  `Badge`, `Toast` through `useToast()`, `Dialog`, `AlertDialog`, `BottomSheet` with snap points.
- **Content**: `Table` scrolls horizontally when its columns do not fit; `CodeBlock` has languages,
  line numbers, wrapping, and copy.
- **Markdown**: a `Markdown` component with **its own TypeScript parser**: headings, lists, task
  lists, tables, code, blockquotes, no raw HTML, a dialect of its own rather than full GFM
  (`Markdown.spec.md`). Task list checkboxes are read-only (`Markdown.tsx:1579`). It can attach data
  to blocks by source range, which its docs suggest for "review annotations"
  (`createMarkdownSourceDecoration`), but positions exist for top-level blocks only (`ast.ts`).
- **Responsive design**: breakpoints at 640, 768, 1024, 1280, and 1536 px; no responsive props on
  `Stack`, `Grid`, or `Heading`; `useMediaQuery` instead. The open tracker
  [#4476](https://github.com/facebook/astryx/issues/4476) says "there is no cohesive responsive-web
  system" yet, safe areas and keyboard-aware layout included.
- **Touch targets**: controls are 28, 32, or 36 px tall (`theme/tokens.stylex.ts:179`), under the 44
  pt Apple recommends; a theme rule on `pointer: coarse` can raise them (`defineTheme.ts:395`).
  [#6013](https://github.com/facebook/astryx/issues/6013) reports `SegmentedControl` at 32 px even
  at `lg`.
- **Setup**: the [README](https://github.com/facebook/astryx) imports `reset.css`, `astryx.css`,
  then a theme's `theme.css`, wraps the app in `<Theme theme={neutralTheme}>` from
  `@astryxdesign/theme-neutral`, and sets the body font itself. Today's
  [`main.tsx`](/packages/web/src/main.tsx) has the first two only, and no theme package.
- **Maturity**: 0.x and beta, from Meta; 0.2 to 0.6 each had breaking changes, with codemods
  (`CHANGELOG.md`). Open issues touch Markdown lists
  ([#6330](https://github.com/facebook/astryx/issues/6330)) and the mobile drawer
  ([#5701](https://github.com/facebook/astryx/issues/5701)).

### fate

fate is `@nkzw/fate` and `react-fate` 1.7.7, the latest release, from 2026-10-05. Facts come from
the installed package and its `docs/` folder, a copy of fate.technology's guides.

- **Sources**: fate "currently provides database adapters for Prisma and Drizzle, but the framework
  itself is not coupled to a particular ORM" (`docs/integrations/server.md`). No guide covers a
  source of your own.
- **What a custom source needs**: `createFateServer` requires `sources: { getSource, registry }`.
  `SourceRegistry` and `SourceDefinition` are exported; the executor types and the helper
  `createSourceRegistry` are not (`lib/executor-*.d.mts:350-372`). fate's own test builds an
  in-memory source the same way the
  [temporary source](/packages/server/src/temporary-spec-folders.ts) does, with a cast
  ([http.test.ts](https://github.com/nkzw-tech/fate/blob/main/packages/fate/src/server/__tests__/http.test.ts)).
- **One source per type**: `createFateServer` registers each view's source under its type name, and
  the Vite plugin generates a `byId` root for every type (`lib/server.mjs:377-405`,
  `lib/vite.mjs:596-610`). The temporary source returns one definition for every view, which only
  works with a single type.
- **Mutations**: declared in `createFateServer({ mutations })` with an input schema, called with
  `fate.mutations.x.y({ input, optimistic })` or React's `useActionState`; the optimistic value is
  written to the cache and rolled back on failure (`docs/guide/actions.md`).
- **Live views**: one server-sent events stream per client, on `GET /fate/live`; the server
  publishes with `live.update(type, id)` or `live.connection(root).invalidate()`, and refetches
  through the same sources, so a custom source works (`docs/guide/live-views.md`, `lib/server.mjs`).
  Today's [`app.ts`](/packages/server/src/app.ts) only mounts `POST /fate`.
- **Nested data**: a field selected with `true` is an opaque value, replaced whole; a nested view is
  an entity, and needs an `id` unique within its type (`lib/vite.mjs:98-101`, `lib/index.mjs:421`).
- **Lists** page by 20 by default (`sourceRouter`, `defaultSize = 20`), which the temporary page
  works around with `first: 1000`.
- **Pace**: 1.7.2 to 1.7.7 shipped within five days.

The fallback the stack decision names, Hono's typed client with TanStack Query, writes each
optimistic update by hand (`onMutate`, `onError`, `onSettled`) and invalidates queries by key from
an SSE route built with Hono's `streamSSE`. TanStack Query is not installed; its current
documentation was not read (see [not checked](#not-checked)).

### Markdown parsers

- The core uses pulldown-cmark 0.13.4 with GFM, tables, task lists, front matter, and wikilinks,
  through `into_offset_iter`, whose events carry byte ranges
  ([`markdown.rs`](/crates/core/src/files/markdown.rs),
  [OffsetIter](https://docs.rs/pulldown-cmark/0.13.4/pulldown_cmark/struct.OffsetIter.html)).
- Its `BlockQuoteKind` has `Note`, `Tip`, `Important`, `Warning`, and `Caution` only, so the skill's
  `> [!QUESTION]` parses as a plain quote. Typed bullets and list callouts are plain text to every
  parser.
- comrak 0.56 renders HTML with `data-sourcepos` attributes, reliable except on lists and list
  items, with the same five alert types
  ([Render options](https://docs.rs/comrak/latest/comrak/options/struct.Render.html),
  [AlertType](https://docs.rs/comrak/latest/comrak/nodes/enum.AlertType.html)).
- In TypeScript, react-markdown 10.1 with remark-gfm 4.0 renders markdown with a position on every
  node ([react-markdown](https://github.com/remarkjs/react-markdown),
  [unist](https://github.com/syntax-tree/unist)). The Obsidian callout plugin was archived in 2025
  ([remark-obsidian-callout](https://github.com/escwxyz/remark-obsidian-callout)).
- react-markdown escapes HTML by default; rendering HTML produced elsewhere needs a sanitizer such
  as DOMPurify 3.4 (same sources).
- The workflow files of the [example](/skills/uraeda/assets/example/specs/) and of
  [`specs/`](/specs/) fence code as `text`, `bash`, `tsx`, `ts`, `rust`, `json`, and `markdown`, and
  contain no mermaid diagram.

### Text editors in the browser

- A `<textarea>` edits the raw text and keeps every byte the user does not change.
- CodeMirror 6 claims native selection and editing on phones
  ([codemirror.net](https://codemirror.net/)); with its markdown language it weighs about 175 KB
  gzipped (bundlephobia). Forum threads report missing selection handles and autocorrect quirks on
  iOS (snippets only:
  [selection handles](https://discuss.codemirror.net/t/ios-safari-missing-selection-drag-handles/9679)).
- Monaco does not support mobile browsers ([FAQ](https://github.com/microsoft/monaco-editor)).
- Rich editors (Milkdown, TipTap, MDXEditor, Lexical) parse markdown into a document and write it
  back, normalising it: Milkdown has open round-trip bugs on lists, marks, and escapes
  ([issues](https://github.com/Milkdown/milkdown/issues?q=round+trip+markdown)). Syntax they do not
  know, like `[pro]` or `- ! warning`, would be escaped.

### iOS Safari and touch targets

- Apple recommends 44 × 44 pt controls, 28 pt at least, and 17 pt body text
  ([HIG, accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)).
- WCAG 2.2 success criterion 2.5.8 (AA) requires targets of 24 × 24 CSS px, with exceptions for
  inline links
  ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)).
- `100vh` equals the large viewport, so content can sit under Safari's toolbars; `svh` and `dvh`
  avoid it ([MDN, length](https://developer.mozilla.org/en-US/docs/Web/CSS/length)).
- The on-screen keyboard shrinks the visual viewport, not the layout one, so a fixed bottom bar can
  end up under it
  ([MDN, VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)); the
  `interactive-widget` viewport key that would fix it is not supported in Safari (snippet only:
  [caniuse](https://caniuse.com/mdn-html_elements_meta_name_viewport_interactive-widget)).
- `viewport-fit=cover` needs the `env(safe-area-inset-*)` paddings
  ([MDN, env](https://developer.mozilla.org/en-US/docs/Web/CSS/env)).
- On iOS 18, a backgrounded `EventSource` stays open without firing `error`
  ([Apple forum](https://developer.apple.com/forums/thread/765183)); htmx and Datastar close the
  stream when the page is hidden and reconnect when it is shown
  ([htmx SSE](https://four.htmx.org/docs/extensions/sse)).

### Tailscale

- `tailscale serve <port>` proxies the tailnet to `http://127.0.0.1:<port>` under the machine's
  `*.ts.net` name, over HTTPS, within the tailnet's access rules
  ([serve](https://tailscale.com/kb/1312/serve)).
- It adds `Tailscale-User-Login` and `Tailscale-User-Name` headers, strips incoming copies, and
  advises services relying on them to listen on localhost only (same source).
- The proxy keeps the browser's `Host`, `<machine>.<tailnet>.ts.net`, and adds `X-Forwarded-Host`
  and `X-Forwarded-Proto`
  ([serve.go](https://github.com/tailscale/tailscale/blob/main/ipn/ipnlocal/serve.go)).

### Vite+ and the dev server

- `vp dev` always starts Vite's dev server with the current folder's `vite.config.ts`; `vp run dev`
  runs the `dev` script, and a script cannot replace a built-in command
  (`node_modules/vite-plus/docs/guide/dev.md`, `guide/run.md`).
- The root [`vite.config.ts`](/vite.config.ts) configures lint, format, tests, and staged files
  only. `vp dev` at the root prints a hint about `vpr dev` and serves a 404.
- The root `dev` script starts the server and the UI's dev server in parallel: the server on port
  4310, reading `../../specs`, and Vite proxying `/fate` to it ([`package.json`](/package.json),
  [`packages/server/package.json`](/packages/server/package.json),
  [`packages/web/vite.config.ts`](/packages/web/vite.config.ts)).
- `@hono/vite-dev-server` 0.26.1 runs a fetch-based app, Hono included, inside Vite's dev server
  ([README](https://github.com/honojs/vite-plugins/tree/main/packages/dev-server)).
- Vite rejects requests whose `Host` is not localhost or an IP address, unless listed in
  `server.allowedHosts`, where `.ts.net` allows every subdomain
  ([GHSA-vg6x-rcgg-rjx6](https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6)).

### File watching

- Node's `fs.watch` is recursive on Linux since 19.1; the project runs Node 24. Its `filename` is
  "not always guaranteed", and editors saving by rename give the file a new inode
  ([Node 24 fs](https://nodejs.org/docs/latest-v24.x/api/fs.html)).
- chokidar 5 is ESM-only, for Node 20 and later, and handles atomic writes
  ([README](https://github.com/paulmillr/chokidar)).
- VS Code refuses to save over a file changed on disk, and offers to compare or overwrite
  ([textFileSaveErrorHandler.ts](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/files/browser/editors/textFileSaveErrorHandler.ts));
  Obsidian merges external changes automatically, and users report lost edits (forum reports:
  [111594](https://forum.obsidian.md/t/has-been-modified-externally-merging-changes-automatically/111594)).

## The code

### Important reads

- [Stack decision](../decisions/stack.md): logic, parsing, and states in the core; TypeScript
  reaches them only through the binding, with generated types; the UI uses fate unless the
  stack-decision feature replaced it; the server listens on 127.0.0.1 and rejects any other `Host`
  and foreign `Origin`.
- [Git decision](../decisions/git.md): reads through gix, writes through the system `git`, never
  bypassing hooks, in one core module.
- [CLI decision](../decisions/cli.md): the web UI reads the same stable data as `ura`.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): `Workspace::read` (line 351)
  builds every feature, bug, draft, and priority. `PRIORITIES.md` and drafts come from the default
  branch; the current branch's feature from the disk; every other branch at its tip, without a
  checkout. Each feature keeps its files' raw texts in a private map, skipped when serialised (line
  155). Features merged into the default branch are left out, as ruled in
  [R10 of the CLI core](../2026-10-10-cli-core/rulings.md#r10-minor-findings-of-the-final-review-left-for-later).
- [`crates/core/src/steps.rs`](/crates/core/src/steps.rs): the skill's step table, and the pull
  request state through `gh pr list`, run synchronously (line 231).
- [`crates/core/src/files/`](/crates/core/src/files/): line-based parsers that keep 1-based line
  numbers.
  - `markdown.rs` keeps headings, links, and the first callout, not a document tree.
  - `clarifications.rs` keeps each question's id, parent, title, lines, option **letters**, and
    answer, but no option text, recommendation, pros, cons, or context; `set_answer` (line 206)
    refuses answers with a line starting with `#` or `**Answer:**`.
  - `plan.rs` counts checkboxes per task, without their text or lines.
  - `review.rs` parses and renders review files: comments, anchors, quotes, verdict.
  - No parser reads a spec's user stories, scenarios, and success criteria, or rulings.
- [`crates/core/src/actions/`](/crates/core/src/actions/): `answer::write` and `submit`,
  `review::comment`, `approve`, `request_changes` (with the risk tier and plan review set on
  approval), `draft::run`, `start::run`. `place::reach` (`place.rs:184`) finds where to write: the
  current checkout if it is on the branch, another worktree on it, or else a `git switch` of the
  user's checkout, refused with uncommitted changes.
- [`crates/cli/src/answer.rs`](/crates/cli/src/answer.rs) and
  [`review.rs`](/crates/cli/src/review.rs): the commits of answers and reviews, and the switch back,
  are run by the CLI, while `start::run` commits in the core (`actions/start.rs:261`).
- [`crates/core/src/check/`](/crates/core/src/check/): `ura check` reads the working tree only.
- [`crates/binding/src/lib.rs`](/crates/binding/src/lib.rs) and
  [`temporary_status.rs`](/crates/core/src/temporary_status.rs): two temporary functions, the only
  code with napi attributes, behind the core's `napi` feature. Their comments still say "replaced by
  the CLI feature", while the CLI core's spec moved them to this one.
- [`packages/server/src/`](/packages/server/src/): Hono with the guard, fate on `POST /fate`, the
  temporary source, and `--specs`, `--port`, `--allow-origin`, `--web-root` options.
- [`packages/web/src/`](/packages/web/src/): the temporary status page, with Astryx `Stack`,
  `Heading`, `Text`, `Badge`.
- The repository's git configuration sets `core.hooksPath` to the relative `.vite-hooks/_`, a folder
  generated by `vp install` and ignored by git: a fresh checkout or worktree has no hooks until
  `vp install` runs in it. Seen when the repository was cloned again on 2026-10-11.
- [CLI TUIs draft](../drafts/cli-tuis.md) and the CLI core's
  [Q12](../2026-10-10-cli-core/clarifications-01.md#q12-what-does-ura-review-show-and-what-is-the-active-line)
  to [Q14](../2026-10-10-cli-core/clarifications-01.md#q14-what-should-the-tuis-look-like): the
  answer screen goes question by question, with options, pros, cons, and an answer box, and a bottom
  bar with the mode, hints, and progress; review comments anchor on rendered **blocks**, each mapped
  to its source lines.

### The proposal's path and existing actions

- **Opening the UI**: `vp dev` at the root serves nothing today; `vp run dev` starts two processes,
  reachable from 127.0.0.1 only.
- **Seeing what waits**: `Workspace::read` and `steps::step` compute it, as `ura status --json`
  prints it; the binding does not expose them.
- **Reading a file**: the core has the raw text (`Feature::text`) and thin parsed items, none of it
  exposed.
- **Answering a question without submitting**: `ura answer <Q> <text>` writes the answer in the
  working tree of the feature's branch, uncommitted, switching to it first. A server running from
  the same checkout would switch the branch under itself, its own code included when the repository
  is Uraeda, and the uncommitted answer would then block every later switch.
- **Submitting a round**: `answer::submit` refuses blank applicable questions, sets `answered`, and
  turns the block into a record; the CLI commits.
- **Commenting on a spec or plan**: `review::comment` anchors to the version committed at the
  branch's tip, not the working tree (`actions/review.rs:99`), and writes the review file,
  uncommitted.
- **Approving or requesting changes**: the core writes the status, the record, and the verdict; the
  CLI commits.
- **Drafting from a priority line**: `draft::run` writes the draft and `PRIORITIES.md` on the
  default branch, uncommitted.
- **Starting a feature** ("update to proposal"): `start::run` commits on the default branch, creates
  the branch, and moves the draft, committing again.
- **Editing a proposal or a draft**: no action exists; it is editing the file and committing it.
- **An agent or a checkout changing a file while the human edits it in the browser**: nothing
  detects it today.

### Features in flight

Only this branch and `main` exist. The [CLI TUIs](../drafts/cli-tuis.md) draft will need the same
block rendering with source lines, for `ura review`.

### Likely changes

- [`crates/core/src/files/`](/crates/core/src/files/): richer parsers under every option: option
  texts and their recommendation, pros and cons, question context; user stories, scenarios, and
  success criteria; plan checkboxes with lines; rulings. With option A of
  [rendering](#where-the-rendering-structure-comes-from), a block tree of each file with source
  lines.
- [`crates/core/src/actions/`](/crates/core/src/actions/): the commits of answers and reviews moved
  from the CLI into the core, so the binding and `ura` share them; with option A of
  [writing to branches](#writing-to-feature-branches), a worktree per branch.
- [`crates/core/src/workspace.rs`](/crates/core/src/workspace.rs): with option A of
  [finished features](#finished-features), merged features read from the default branch.
- [`crates/binding/`](/crates/binding/) and [`packages/binding/`](/packages/binding/): the real
  functions, as napi async tasks since git and `gh` block; data types behind the core's `napi`
  feature; the temporary ones removed.
- [`packages/server/src/`](/packages/server/src/): sources, mutations, and live views with option A
  of [the data layer](#data-layer), or JSON routes with B; a file watcher; the guard changed under
  every option of [network access](#network-access) but C.
- [`packages/web/src/`](/packages/web/src/): every screen, replacing the temporary page.
- [`vite.config.ts`](/vite.config.ts) and [`package.json`](/package.json): `vp dev` at the root
  starting the UI, under every option.
- [Stack decision](../decisions/stack.md): a proposed change with option A or B of
  [network access](#network-access), and with option B of
  [rendering](#where-the-rendering-structure-comes-from).

## The proposal

### Security and the stack decision

The proposal says "No need for any security, I'll run it on my machine and access it through
Tailscale only". The active [stack decision](../decisions/stack.md) requires the server to listen on
127.0.0.1 only, and to reject any `Host` but `127.0.0.1` or `localhost` and any foreign `Origin`,
because the server will commit to git and start agents, and a web page the user visits could
otherwise reach it through DNS rebinding
([local server security](../2026-10-10-stack-decision/discovery-01.md#local-server-security)).

Behind `tailscale serve`, the server still listens on 127.0.0.1, but receives the `*.ts.net` host
and origin, which the guard rejects with a 403, and Vite rejects the host before it
([Tailscale](#tailscale), [Vite+](#vite-and-the-dev-server)). Tailscale removes attackers from the
network, not a malicious page opened on the Mac or the iPhone, which is what the rule protects
against (judgement). Removing the rule or loosening it changes an active decision.

### Running at the root with vp dev

The proposal asks for `vp dev` at the root of the repository to show, "the root of the repo where we
want to show the web-ui". `vp dev` at Uraeda's root serves nothing today. For another repository,
the UI has to come from somewhere: the code lives in Uraeda's workspace, and nothing packages it
([Vite+](#vite-and-the-dev-server)). The proposal does not say which repositories the UI must open
now.

### Update to proposal

"Edit human steps: draft, update to proposal" can mean editing a draft and then a proposal, or
turning a draft into a proposal, which is what `ura start` does. The status table also has human
steps the proposal does not list: reviewing a bug's assessment, and committing a proposal written by
hand ([SKILL.md](/skills/uraeda/SKILL.md#workflow-status)).

### Answers with options and comments

"Each question ... a card, with the answers 3 options, and a free form text input" fits the
template, but questions have 2 to 4 options, some combine ("C can come on top of A or B"), and the
human's answers mix letters and words: "B and C: we need to easily handle weekdays"
([example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)).
The skill also has the **Notes:** line after the settled points.

### Features on other branches

Every feature lives on its own branch, while the server runs from one checkout
([branches](/skills/uraeda/SKILL.md#branches)). Reading other branches works without a checkout;
writing does not ([the proposal's path](#the-proposals-path-and-existing-actions)). From an iPhone,
the human cannot switch branches or clean a checkout by hand.

### Finished features

"View all steps of the workflow" includes finished features, but the core leaves out features merged
into the default branch: in Uraeda today, the stack-decision and CLI core features would not show
([important reads](#important-reads)).

### Plan review comments

The proposal lists "plan review". A plan is reviewed by the human only when the spec's `plan-review`
is `true`; otherwise it is `auto-approved`, and has nothing to review
([SKILL.md](/skills/uraeda/SKILL.md#workflow-status)). Nothing to decide: the review screen shows on
plans waiting for the human.

## Approaches

Criteria come from the [proposal](proposal.md) (readable hierarchy, the human steps, an iPhone over
Tailscale, `vp dev`, React, Astryx, fate, the Rust core), the [constitution](../CONSTITUTION.md)
(humans in control, plain text in git, asynchronous, review effort, tools optional, simple code),
and the active decisions: [stack](../decisions/stack.md), [git](../decisions/git.md),
[CLI](../decisions/cli.md), [toolchain](../decisions/toolchain.md).

### Scope of the human actions

Which human steps the UI performs. See [update to proposal](#update-to-proposal).

| Option                                                                   | Covers the status table           | Effort                                    |
| ------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------- |
| A. Every human step: answers, reviews (assessments too), drafts, starts  | Yes                               | Each action exists in the core already    |
| B. The proposal's list: answers, spec and plan reviews, drafts, proposal | Bugs and starting left to the CLI | Slightly less                             |
| C. A, plus editing any workflow file as raw text                         | Beyond it                         | A spec edit must also bump its `revision` |

### Finished features

Whether merged features show. See [finished features](#finished-features).

| Option                                                  | Shows the history         | Effort                                      |
| ------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| A. Read merged folders from the default branch, as done | Yes                       | A fix in `Workspace::read`, deferred by R10 |
| B. Leave them out, like `ura status`                    | No: only work in progress | None                                        |

### Writing to feature branches

Where the server writes when a feature's branch is not checked out. See
[features on other branches](#features-on-other-branches) and [important reads](#important-reads)
(hooks in a fresh worktree).

| Option                                                              | Works from a phone               | Running server and editor                   | Hooks                                           |
| ------------------------------------------------------------------- | -------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| A. A worktree per feature branch, created by the server when needed | Yes                              | Untouched                                   | Need `core.hooksPath` absolute, or `vp install` |
| B. Write only where a worktree has the branch; others read-only     | Only for branches set up by hand | Untouched                                   | The user's own                                  |
| C. Switch the checkout, like `ura answer`                           | Until a draft blocks the switch  | Switched under them, Uraeda's code included | The user's own                                  |

### Network access

How the iPhone reaches the server. See [security](#security-and-the-stack-decision).

| Option                                                                    | Stack decision              | Protects against a malicious page | Setup              |
| ------------------------------------------------------------------------- | --------------------------- | --------------------------------- | ------------------ |
| A. `tailscale serve` to 127.0.0.1, the guard allows the ts.net host given | Host rule amended           | Yes                               | One command, HTTPS |
| B. A, and requests through Tailscale must carry `Tailscale-User-Login`    | Host rule amended           | Yes, and only tailnet users       | Same               |
| C. Listen on every interface, no guard                                    | Bind and Host rules removed | No, and the LAN reaches it        | None               |

### Where the rendering structure comes from

What turns a workflow file into what the UI draws. See [markdown parsers](#markdown-parsers) and
[Astryx](#astryx).

| Option                                                                                      | Stack decision ("MUST NOT reimplement parsing") | Source lines for comments        | Callouts, typed bullets |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------- | ----------------------- |
| A. The core sends a block tree with source lines and the structured items; React draws them | Fits                                            | Every block, list items included | The core's, all of them |
| B. The core sends structured items; free text is drawn by Astryx's `Markdown`               | Needs a ruling: a second parser                 | Top-level blocks only            | Plugins to write in TS  |
| C. The core renders HTML with source positions                                              | Fits                                            | Most blocks, not list items      | The core's, as HTML     |

With A, the [CLI TUIs](../drafts/cli-tuis.md) can draw the same tree in the terminal.

### Data layer

How the UI gets data and sends actions. See [fate](#fate).

| Option                                                                | Stack decision                 | Live updates                    | Optimistic updates | Effort                                            |
| --------------------------------------------------------------------- | ------------------------------ | ------------------------------- | ------------------ | ------------------------------------------------- |
| A. fate, with a source per type over the binding, and live views      | Fits; its fallback rule can go | Built in, from a file watcher   | Built in           | A source per type; undocumented source internals  |
| B. Hono's typed client and TanStack Query, as the decision's fallback | Fits only if fate cannot do it | An SSE route, queries refetched | Written by hand    | A route per resource and action; a new dependency |

### Navigation

How the screens are organised, on a phone first. See
[Linear and GitHub Projects](#linear-and-github-projects), [Obsidian](#obsidian), and
[Astryx](#astryx) (`AppShell`, `MobileNav`).

| Option                                                                            | Shows what waits first | On a phone              | Effort |
| --------------------------------------------------------------------------------- | ---------------------- | ----------------------- | ------ |
| A. An inbox of what waits on the human, then features; a feature's files in order | Yes                    | Drawer, one column      | Medium |
| B. A file tree of `specs/`, like Obsidian                                         | No                     | Drawer with a deep tree | Small  |
| C. A board with a column per step                                                 | Partly                 | Columns scroll sideways | Medium |

### Answering questions

How a round of questions is answered. See
[Claude Code's question tool](#claude-codes-question-tool), [Spec Kit](#spec-kit), and
[answers with options and comments](#answers-with-options-and-comments).

| Option                                                                 | Context between questions | On a phone                   | Matches the TUI |
| ---------------------------------------------------------------------- | ------------------------- | ---------------------------- | --------------- |
| A. Every question as a card on one page, follow-ups under their parent | Kept: scroll back         | Long page, natural scrolling | No              |
| B. One card per screen, previous and next, then a summary              | One at a time             | Focused, more taps           | Yes             |

### Editing text

How drafts, proposals, answers, and comments are typed. See
[text editors in the browser](#text-editors-in-the-browser).

| Option                    | Keeps the file exact | iPhone                        | Bundle            |
| ------------------------- | -------------------- | ----------------------------- | ----------------- |
| A. Astryx's `TextArea`    | Yes                  | Native, no zoom (16 px floor) | None              |
| B. CodeMirror 6, markdown | Yes                  | Reported selection issues     | About 175 KB gzip |
| C. A rich editor          | No: rewrites syntax  | Varies                        | 40 to 60 KB gzip  |

### Opening another repository

Which repositories the UI opens now. See [running at the root](#running-at-the-root-with-vp-dev).

| Option                                                                          | Effort                             |
| ------------------------------------------------------------------------------- | ---------------------------------- |
| A. `vp dev` at Uraeda's root opens Uraeda; a variable points it at another repo | Small                              |
| B. Uraeda only                                                                  | None                               |
| C. A command run from any repository, like `ura web`                            | Packaging the server and its addon |

### New dependencies

What the UI adds to the project. See [Astryx](#astryx) (setup) and the topics above.

| Option                                | What it brings                        |
| ------------------------------------- | ------------------------------------- |
| A. `@astryxdesign/theme-neutral` only | The quickstart's theme and its tokens |
| B. None                               | Astryx's base tokens only, no theme   |

The rest needs none: file watching uses Node's `fs.watch`, editing a `TextArea`, rendering the core.

### Needs no choice

- **Review comments pending, then submitted with a verdict**: already the workflow's model, with the
  review file holding pending comments ([review files](/skills/uraeda/SKILL.md#review-files)).
- **Comments anchored to blocks**: the human chose blocks for `ura review`
  ([Q12](../2026-10-10-cli-core/clarifications-01.md#q12-what-does-ura-review-show-and-what-is-the-active-line));
  the web UI follows it.
- **A per-file "viewed" mark**: reviews here are of one file at a time, so it has nothing to track.
- **Live updates**: with fate, live views are what the stack decision chose it for; with option B of
  [the data layer](#data-layer), an SSE route.
- **Conflicting edits**: a save sends the hash of the text it started from, and the server refuses
  it if the file changed, like VS Code ([file watching](#file-watching)).
- **Long texts**: options, pros, and cons wrap; nothing is cut off.
- **Notifications**: "Ping user when input is needed" is its own entry in
  [the priorities](../PRIORITIES.md).

## Not checked

- TanStack Query's current documentation and version: the fallback was compared from fate's side and
  Hono's.
- fate.technology's guide pages online: the package's `docs/` folder was read instead.
- Whether napi-rs can generate types for a recursive enum, as a block tree needs.
- How Vite's HMR websocket behaves behind `tailscale serve` on an iPhone: not tested.
- Claude Code's own terminal layout for its question tool: no first-party description found.
- The Astryx CLI's component docs and templates: not installed, so not run.
- Devin's planning page, and Copilot Workspace's (sunset in 2025): their content did not load.
