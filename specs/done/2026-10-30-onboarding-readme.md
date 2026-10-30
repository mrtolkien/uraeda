---
kind: feature
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/72
---

# Record: Onboarding + README pass

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/72). Its full files are
> in git: `git log -- specs/2026-10-30-onboarding-readme/`.

## What and why

Uraeda's workflow, files, and vocabulary had settled, and it was time to make it easy for a human to
start with. The README had grown into a 3,500-word reference; it becomes a short, appealing page
that says what Uraeda is, a workflow first, then a CLI, then a web UI. A project set up by
`ura init` alone looked ready on Home while its constitution was still the template: Home and
`ura status` now say what the project lacks, and a button hands the setup to the agent.

## Behaviour

- The README opens with the dot-tree banner, light and dark, then screenshots of Home, a round of
  questions, and a spec, desktop beside phone, each following GitHub's theme. Then what Uraeda is,
  one feature's walk through the workflow, a quick install, getting started, and links. It stays
  under 1,000 words.
- The full install is in [`INSTALL.md`](/INSTALL.md); reference for users in
  [`docs/web-ui.md`](/docs/web-ui.md), [`docs/cli.md`](/docs/cli.md), and
  [`docs/specs-folder.md`](/docs/specs-folder.md); building, testing, and releasing in
  [`CONTRIBUTING.md`](/CONTRIBUTING.md). Every fact of the old README is in one of them.
- A project is set up once its constitution is written and its code-quality and testing decisions
  exist, whatever their status; the preview decision is optional. A constitution is still the
  template while its title, a principle's name, a rule, or a date holds bracketed text that is not a
  link, a reference, a wikilink, a footnote, a task box, or a callout, like `[Project]`.
- Home shows a Setup pane first, full width, while a required file is missing: each item, written or
  not, the count of required items left, and "Set up with the agent". Without `specs/`, it is Home's
  only content. Each item that turns written is announced as a polite status, and the pane closes in
  200 ms once the project is set up.
- "Set up with the agent" opens the New page on a session, its composer holding
  `/uraeda Set this project up for Uraeda: write what is missing, ask me before writing the constitution, never overwrite a file.`,
  unsent; a reload fills an empty composer again. Without Claude Code, the pane shows the message to
  copy and a link to Claude Code's setup page.
- `ura status` ends with `Setup: N files missing` and one line per required file not written, and
  `ura status --json` has a `setup` array of `{ key, name, state, required }`, empty once set up.
- Without `specs/`, the Decisions, Inbox, and Priorities pages, and a note's address, say to set the
  project up from Home, through one guard, `WithSpecs` in
  [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx); the ＋ Note and ＋ Proposal buttons,
  and the keys that open their forms, are gone, and nothing reads the inbox, the priorities, or the
  ledger, which the core cannot give there.
- `vp run readme:screenshots` builds the sandbox's realistic project afresh, with its two turns at
  work, and takes the README's 12 screenshots into `docs/images/screenshots/`.

## Design

What "set up" means is computed once, in the core, and both tools draw it. The check reads the
constitution and looks the decisions up where the ledger reads them, the default branch's checkout
or its tip, so every checkout lists the same items, and it gives an empty list once the project is
set up.

- The check, [`crates/core/src/api/setup.rs`](/crates/core/src/api/setup.rs), and the placeholder
  rule beside the template's other one, `has_placeholder_span` in
  [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs). The workspace view's `setup` field
  carries it to the server and the UI, with or without `specs/`.
- `ura status`'s Setup lines and JSON, in [`crates/cli/src/status.rs`](/crates/cli/src/status.rs),
  and the skill's rule in
  [`references/projects.md`](/skills/uraeda/references/projects.md#setting-up-a-project).
- The setup message, `SET_UP_PROJECT`, with the other default-branch messages in
  [`round-messages.ts`](/packages/server/src/runner/round-messages.ts).
- The Setup pane and its announcer, [`home/Setup.tsx`](/packages/web/src/home/Setup.tsx), placed on
  [`Home.tsx`](/packages/web/src/Home.tsx) in a closing room shared with the column's Unfold,
  [`layout/Room.tsx`](/packages/web/src/layout/Room.tsx); the New page's `insert: "setup"`, in
  [`NewPage.tsx`](/packages/web/src/NewPage.tsx).
- The screenshots' command,
  [`scripts/readme-screenshots.ts`](/packages/web/scripts/readme-screenshots.ts), on the server and
  browser contexts shared with the review screenshots in
  [`scripts/shots.ts`](/packages/web/scripts/shots.ts).
- The sandbox's fifth project, `bare`, a repository without `specs/`, in
  [`samples/projects.ts`](/packages/web/samples/projects.ts).

## Replaced behaviour

- **Without `specs/`, Home showed the warning "No specs/ folder in …. Set Uraeda up with ura
  init."**: Home shows the Setup pane instead. The server's test "starting in a repository without
  specs/ adds it, given: %s" stays, and now also checks the workspace's `setup`.
- **The README held the whole reference**: it moved to `INSTALL.md`, `docs/`, and `CONTRIBUTING.md`.
  No test guarded it.
- No test was removed. The core's test `the_ledger_reads_alone` allows 11,100 words of decisions, up
  from 11,000, for the documentation decision.

## Gotchas

- The setup check returns no item once the project is set up, so the Setup pane keeps the last items
  it drew, each required one marked written, while it closes: the last file written is still
  announced. See [`Home.tsx`](/packages/web/src/Home.tsx) `SetupRoom`.
- The `specs/` folder's item leaves the list once the folder exists rather than turning written: the
  announcer counts an unwritten item that leaves the list as written. See
  [`home/Setup.tsx`](/packages/web/src/home/Setup.tsx) `SetupAnnouncer`.
- The New page's session composer keeps its draft in memory only, so the setup message's history
  entry stays, and fills an empty composer again after a reload. See
  [`NewPage.tsx`](/packages/web/src/NewPage.tsx) `useSetupMessage`.
- The README's screenshots show the Usage pane's reset times, which follow the clock: every run of
  `vp run readme:screenshots` changes the desktop images a little.

## Questions

### Round 01

#### Q1: Where does the README's long reference go?

**Answer:** A: pages under `docs/`, with building Uraeda in `CONTRIBUTING.md`, linked from the
README. The spec's review added `INSTALL.md` for the full install, with a quick install kept in the
README.

#### Q2: Which banner opens the README?

**Answer:** A: the dot tree and "URAEDA" in dots, in a light and a dark file, without motion.

#### Q3: How does the README tell a Claude Code user to get the workflow?

**Answer:** A: `ura install`, or `npx skills add mrtolkien/uraeda` without `ura`; no plugin
marketplace.

#### Q4: Which files must a project have to count as set up?

**Answer:** A: a written constitution, and the code-quality and testing decisions; the preview
decision optional.

#### Q5: Where does Home show what is missing?

**Answer:** A: a Setup pane, first on Home, gone once the project is set up.

#### Q6: Does `ura status` show the same missing items?

**Answer:** A: yes, after its list of features, from the same check in the core.

## Decisions

- [Documentation](../decisions/documentation.md), new: the README holds what a newcomer needs, a
  quick install included; the full install lives in `INSTALL.md`, reference in `docs/`, building
  Uraeda in `CONTRIBUTING.md`; documentation may repeat what helps its reader.

## Changes after approval

- The spec's review asked for screenshots under the banner, from the sandbox's realistic project,
  refreshed by one command; a quick install in the README with the rest in `INSTALL.md`; that
  documentation may repeat the skill's rules; and that the build not wait for the performance pass.
- The README's Home screenshot shows the realistic project with two turns at work and its usage, not
  an idle project, and the 12 screenshots weigh about 650 KB, not the 400 KB the spec estimated.
- Any bracketed text left in a written rule, like `[RFC 9110]`, keeps the constitution "still the
  template", as the skill now says.
- The sandbox's `sample` project gained Uraeda's code-quality and testing decisions, so its Home,
  the one reviews open, shows no Setup pane; `empty` and `bare` show it.
- A repository without `specs/` no longer shows "Could not reach the Uraeda server." on any page the
  shell or the Setup pane leads to: the spec kept a warning on the Decisions page only, and the
  Inbox and Priorities pages, a note's address, and the ＋ buttons needed the same guard.
- The documentation decision's icon, `book-open`, was added to the decisions page's icons.

## Follow-ups

- Four agents' notes in the inbox, under Deferred fixes: a session draft kept by "Set up with the
  agent", "Setup · 0" during the pane's close, the realistic fixture's missing documentation
  decision, and the screenshots script's reliance on the first page load to start its turns.
- The New page's Change and Feature cards still show in a repository without `specs/`, though
  nothing can be started from them.
