---
status: awaiting-human
revision: 1
clarifications: 2
risk-tier: high
plan-review: false
---

# Spec: UI iteration flow

> [!IMPORTANT]
>
> Spec to review, about 30 minutes.
>
> - **Your round 02 answer, as I read it.** Every project with a UI gets a Storybook:
>   - its own, when its stack has one;
>   - otherwise a small mockups Storybook in React with Astryx, inside the project, whose stories
>     live in each feature's `mockups/` folder.
>   HTML mockups stay only for projects that decline.
> - **Nothing after the pull request**, as your note on "After the code" says. Fixes after the pull
>   request still go through the session.
> - **A new decision, preview.** Uraeda's mockups and UI states are stories in `packages/web`, and
>   Storybook runs Uraeda's real server over the fixture repository, so stories show real data.
> - **A changed decision, stack.** Uraeda's server may run a project's Storybook in a feature's
>   worktree, on its own port, and the UI embeds its stories from there. The server's `Origin` rule
>   is unchanged.
> - **A limit of that choice.** Stories run on 127.0.0.1, so they embed only on the computer that
>   runs Uraeda, not from your phone.
> - **A cost.** Storybook adds about 100 MB of development dependencies, and a release to follow
>   every six to eight weeks. It was tested in a scratch project, not yet with this repository's own
>   Vite config.
> - **Risk tier `high`.** The server starts project processes. The plan does not wait for your
>   review.

Mockups become the real UI, live in the spec. The agent writes a planned view as stories in the
project's Storybook. A link to a story, alone on its line in a spec or a question, shows the story
running, at a phone or desktop width. You comment on the whole story, or on an element you pick
inside it. A visual question offers variants as stories, and the one you pick is the code that
ships. Every project with a UI gets a Storybook, Uraeda's own included, with stories fed by its real
server. This answers the proposal's complaint that HTML mockups end up "far from the actual
results". See the [proposal](proposal.md), the discoveries [01](discovery-01.md) and
[02](discovery-02.md), and the clarifications [01](clarifications-01.md) and
[02](clarifications-02.md).

## User stories

The scenarios use a future feature of Uraeda, `2026-10-20-sidebar-resize`, checked out in
`.worktrees/2026-10-20-sidebar-resize/`. Its stories are in
`packages/web/src/SidebarHandle.stories.tsx`, under the title `SidebarHandle`.

### US1: See planned UI live in the spec (P1)

The human opens a spec, and each story it links stands where it is linked, running, as wide as a
phone or a desktop. Storybook starts by itself the first time.

Why this priority: it is the proposal's core: validating behaviour and UX before the code, on the
real UI.

Acceptance scenarios:

1. **Given** Uraeda's preview decision is active, the spec of `sidebar-resize` waits for review, and
   under US1 a paragraph holds only
   `[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`, and the worktree's
   Storybook is not running, **When** the human opens the spec at 1440 × 900, **Then**:
   - the embed, titled "Dragging the handle", reads "Starting Storybook for this branch…";
   - the server runs the decision's command in `.worktrees/2026-10-20-sidebar-resize/packages/web`,
     with a free port of 127.0.0.1 in place of `{port}`;
   - once the Storybook's index lists the story, the embed shows the story
     `sidebarhandle--dragging`, running, drawn 1440 px wide and scaled to the reading column.
2. **Given** that embed, **When** the human presses "Phone", **Then** the story is drawn 402 px
   wide, unscaled. **When** they drag the handle inside it, **Then** the story's own behaviour runs.
3. **Given** that embed, **When** the human presses "Open in Storybook", **Then** a new tab opens
   `http://127.0.0.1:<port>/?path=/story/sidebarhandle--dragging`.
4. **Given** Uraeda in dark mode, **When** the embed is ready, **Then** the story is drawn in dark
   mode, and switching Uraeda to light switches the story too.
5. **Given** a phone, 402 × 874, **When** the same spec opens, **Then** the embed is as wide as the
   page, at "Phone", with its buttons as icons named "Width", "Pick an element", "Comment", and
   "Open in Storybook".
6. **Given** the spec approved, **When** it opens, **Then** the embed shows the same way.
7. **Given** a second page embedding a story of the same worktree, **When** it opens, **Then** it
   uses the same running Storybook.

### US2: Comment on an element of a live mockup (P1)

The human switches to pick mode, clicks the element that is wrong, and writes what to change. The
comment lands in the spec's review, naming the story and the element.

Why this priority: small, targeted fixes are why the proposal exists.

Acceptance scenarios:

1. **Given** US1's embed ready, its Storybook loading the pick script, **When** the human presses
   "Pick an element", **Then**:
   - the embed reads "Click an element to comment on it. Escape to stop.";
   - the element under the pointer is outlined;
   - clicks inside the story no longer act on it.
2. **When** they click the button "Hide the sidebar", **Then** pick mode ends, and a comment form
   opens under the embed, reading "Comment on Dragging the handle, button “Hide the sidebar”".
3. **When** they type "This should be an icon button." and press Ctrl+Enter, **Then**
   `spec-review.md` holds a comment on the embed's line, under "US1: Resize the sidebar (P1)", whose
   text is
   `Story SidebarHandle.stories.tsx#Dragging, button “Hide the sidebar”: This should be an icon button.`
4. **Given** the embed, **When** the human presses "Comment" without picking, and writes "Too slow
   to start dragging.", **Then** the comment's text is
   `Story SidebarHandle.stories.tsx#Dragging: Too slow to start dragging.`
5. **Given** pick mode, **When** the human presses Escape, **Then** pick mode ends, no form opens,
   and the story reacts to clicks again.
6. **Given** a Storybook that does not load the pick script, **When** its embed is ready, **Then**
   "Pick an element" is not shown, and "Comment" is.

### US3: Pick between variants in a round of questions (P2)

The agent asks a visual question whose options are stories. The human tries each one live, picks one
by its letter, and the picked variant's code stays as the start of the implementation.

Why this priority: choices between looks and behaviours are the human's, and are best made on the
real thing.

Acceptance scenarios:

1. **Given** `clarifications-01.md` of `sidebar-resize`, with Q2's option A holding, alone in a
   paragraph, a link to `/packages/web/src/SidebarHandle.stories.tsx#ThinLine`, and option B one to
   `#Grip`, **When** the human opens the round at 1440 × 900, **Then** each story is embedded under
   its option's button, not inside it. Pressing option A's button picks A, as for any option.
2. **Given** pick mode in option B's story, **When** the human picks the handle and writes "Thicker
   grip.", **Then** Q2's answer text gets the line
   `Story SidebarHandle.stories.tsx#Grip, separator: Thicker grip.`
3. **Given** Q2 answered "A", **When** the agent writes the spec, **Then** the same commit deletes
   the `Grip` export from the stories file, keeps `ThinLine`, and the spec embeds
   `SidebarHandle.stories.tsx#ThinLine`.
4. **Given** that commit, **When** the human opens the answered round, **Then** option B's embed
   reads "This variant was removed after your answer."
5. **Given** the spec approved, **When** the plan is written, **Then** its first task for that view
   adds the tests of the view's scenarios, then wires the `ThinLine` component into the app.

### US4: Every project with a UI gets a Storybook (P2)

Setting up Uraeda in a project with a UI proposes a preview decision. A stack Storybook supports
uses its own Storybook. Any other stack gets a mockups Storybook, in React with Astryx, inside the
project.

Why this priority: the flow must work for every repository using Uraeda, whatever its stack.

Acceptance scenarios:

1. **Given** a project with a React and Vite UI, being set up, **When** the agent has proposed the
   code-quality decision, **Then** it proposes `specs/decisions/preview.md` from the template:
   - the project's own Storybook, in the folder that holds its UI;
   - a `preview-command` with `{port}` and `--host 127.0.0.1`;
   - the pick script loaded in its preview.
2. **Given** a Rails project, being set up, **When** the agent proposes the decision, **Then** it
   names a mockups Storybook in `storybook/` at the repository's root, in React with Astryx. Its
   stories are the files `specs/*/mockups/*.stories.tsx`, and its setup is a commit of its own once
   the decision is approved.
3. **Given** a project with a UI and no preview decision, **When** a discovery round on UI work is
   written, **Then** it asks once whether to adopt one. A "no" becomes that decision, saying the
   project has no preview, with a date in its **Revisit when**. Its mockups stay HTML.
4. **Given** a `preview.md` whose `preview-command` lacks `{port}`, **When** `ura check` runs,
   **Then** it reports `specs/decisions/preview.md: "preview-command" has no {port}`.
5. **Given** a Rails project's feature `2026-11-02-invoices`, whose spec embeds
   `[Invoice list](mockups/InvoiceList.stories.tsx#Empty)`, **When** the feature finishes, **Then**
   the stories leave with its folder.

### US5: Uraeda's own Storybook (P2)

Uraeda's states and mockups are stories in `packages/web`, fed by its real server over the fixture
repository, so a story shows what the app shows.

Why this priority: Uraeda is the flow's first user, and its look-and-feel pass the first feature to
need it.

Acceptance scenarios:

1. **Given** the repository, **When** the human runs the preview decision's command in
   `packages/web` with port 6006, **Then** Storybook lists every `*.stories.tsx` of
   `packages/web/src`. Each story gets its data from Uraeda's server over a fresh copy of
   `fixtures/repo`, dated 2026-10-16, on the fake agent.
2. **Given** a story that does not compile, **When** `vp run ready` runs, **Then** the
   `storybook:build` task fails, naming the file.
3. **Given** this feature built, **When** Storybook opens, **Then** `StoryEmbed.stories.tsx` holds
   the embed's states:
   - `Ready`, `Starting`, and `Failed`;
   - `Missing`, `Removed`, `OtherDevice`, and `NoWorktree`.

## Edge cases

- **No active preview decision** in the feature's worktree: a story link is a plain link, opening
  the file as code links do today. HTML mockups work as today.
- **A story link inside a sentence or a list item**: a plain link, opening the file. Only a link
  alone in its paragraph embeds. `## Mockups` lists the stories as list items, and its buttons at
  the top of the review scroll to each story's embed.
- **A story link without `#Export`**: a plain link.
- **Storybook fails to start**, or its process exits: the embed reads "Storybook did not start:
  <its last line of output>", with "Try again", which restarts it.
- **Storybook not ready after 2 minutes**: the embed reads "Storybook did not start within 2
  minutes.", with "Try again".
- **The story is not in the index**: "No story “Dragging” in
  packages/web/src/SidebarHandle.stories.tsx on this branch.", with "Open in Storybook".
- **The story is missing from an answered round**: "This variant was removed after your answer."
- **The feature has no worktree**: "This feature has no worktree, so its stories cannot run here."
- **Uraeda opened from another device**, through a host name other than 127.0.0.1 or localhost:
  "Stories run only on the computer that runs Uraeda."
- **Two features' stories open at once**: each worktree has its own Storybook, on its own port.
- **No view for 30 minutes**: the worktree's Storybook stops. The next view starts it again.
- **Uraeda's server stops**, or `ura clean` removes a worktree: its Storybook process stops with it.
- **A message from any frame other than the embed's**, or from another origin, is ignored.
- **A story whose frame never reports its height**: the embed is 560 px tall, and the story scrolls
  inside it.
- **The agent edits a story while it is embedded**: Storybook reloads it in the frame, as its dev
  server does.
- **A comment whose first line would start with `#` or `>`** cannot happen: the text starts with
  "Story ".
- **A story link in a proposal, a plan, or the notes of a round**: embedded the same way, in every
  workflow file the UI draws.

## Success criteria

- **SC-001**: With the worktree's Storybook running, an embedded story is ready within 2 seconds of
  its page opening. Checked by a browser test on the fake preview.
- **SC-002**: Commenting on an element takes four actions: "Pick an element", a click, the text, and
  Ctrl+Enter. Checked by a browser test counting them.
- **SC-003**: A story link is a plain markdown link, readable on GitHub and in any editor, and
  `ura check` passes on a spec that holds one. Checked by a core check test.
- **SC-004**: No route of Uraeda's server answers with a preview's files. Checked by a server test
  that requests the preview's paths from Uraeda's port.
- **SC-005**: No Storybook process outlives 30 minutes without a view, or the server's stop. Checked
  by the preview runner's tests, with a fake clock.

## Architecture

A planned view is a set of stories in a Storybook, which the project already has or gets, and which
Uraeda runs and embeds
([preview environment](discovery-01.md#a-preview-environment-in-every-project),
[Storybook 10](discovery-02.md#storybook-10)). Stories are code, so the picked variant is the code
that ships, which removes the drift between mockups and code
([pitfalls](discovery-01.md#known-complaints-and-pitfalls)). The Storybook runs on its own origin,
so its code never reaches Uraeda's API, as Claude artifacts and MCP Apps keep generated UI away from
their hosts ([running untrusted UI](discovery-02.md#running-untrusted-ui-next-to-a-host)).

**Units, and where each rule lives:**

- **The skill** owns how agents work:
  - mockups as stories, embedded where they illustrate;
  - visual questions and their variants;
  - keeping the picked variant;
  - the preview decision at setup.

  It also ships the preview decision's template and the pick script, `uraeda-pick.js`. The
  [CLI](/specs/decisions/cli.md) decision requires the skill to carry every rule the tools follow.

- **The core** owns what a file says:
  - which links are story embeds: a link alone in its paragraph, to a `*.stories.*` file, with
    `#Export`;
  - the preview decision's two fields, and their check.
- **The server's preview runner** owns the processes:
  - starting the decision's command in a worktree, on a free port;
  - knowing when it is ready;
  - matching a story link to a story id in its index;
  - stopping it.
- **The web UI's story embed** owns the frame:
  - its width, height, and colour mode;
  - pick mode, through `postMessage` with the pick script;
  - the comment.

  Specs, rounds, and every workflow file draw it in place of the paragraph.

- **Uraeda's Storybook**, in `packages/web/.storybook/`, wraps stories in the theme. It runs the
  server's Vite plugin over the fixture repository, so stories use the real fate client.

**Tradeoffs:**

- A story embeds only on the machine running Uraeda, since previews bind to 127.0.0.1 and Uraeda
  does not proxy them. Proxying would need the server to accept the sandbox's `Origin: null`,
  opening its API.
- Projects without a Storybook-supported stack get mockups in React with Astryx, not in their own
  stack. Those mockups show behaviour and layout, but neither the project's look nor its code.
- Storybook's cold start, a few seconds per worktree, comes on the first view. The dev server,
  unlike a static build, shows an agent's edits at once and works for every stack.
- Several units need splitting first:
  - `ReviewPage` is at 99 of 100 lines, `BlockNode` at 92, and `Question` at 90;
  - `api.rs` is at its line baseline;
  - `document.rs` and `workspace.rs` may only shrink.

  The embeds are read in a new core module, and reached through `api/*.rs`
  ([important reads](discovery-02.md#important-reads),
  [extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow)).

## Mockups

- [Story embeds](mockups/story-embeds.html): the whole page, with a caption for each view:
  - a story embedded in a spec at 1440 × 900;
  - pick mode and its comment form;
  - the embed's other states: starting, failed, missing, removed, another device, no worktree;
  - a visual question with its variants;
  - the phone at 402 × 874, with pick mode's comment sheet.

This mockup is HTML: Uraeda has no Storybook until this feature builds it. The embed's own states
become stories in US5.

## Assumptions

Settled in the clarifications ([round 01](clarifications-01.md#settled-without-the-human),
[round 02](clarifications-02.md#settled-without-the-human)):

- **When a question is visual**: only when seeing helps more than reading. Each one offers two to
  four distinct variants: if two could swap their text unnoticed, they are too alike. Each has a
  one-line tradeoff, with the recommended one first.
- **Widths**: an embed draws its story at 402 or 1440 px, Uraeda's two sizes, in Uraeda's colour
  mode.
- **Mixing variants**: an answer like "A, with B's grip" says it. There are no new mechanics.
- **One session makes the variants**, under the [agents](/specs/decisions/agents.md) decision. Its
  agent may use sub-agents.
- **Mockups are stories**, one export per state or variant, and the picked variant stays.
- **Uraeda runs the Storybook**, starting it on the first view of a worktree's story and stopping it
  after 30 minutes without one.
- **The preview decision is optional**, for projects with a UI only. Setup proposes it, and a UI
  discovery round asks once when it is missing.
- **Stories are previews, not tests**: Storybook's automatic story tests are off. Moving the UI
  tests to Storybook's format is for Next, as your note asks.
- **Screenshots**: none are added. The UI checks decision's screenshots stay as they are, and the
  attachments decision does not change.
- **The questions view** draws an embed beside its option's button, never inside it, after splitting
  `Question`.
- **Before a worktree's first preview**, the project's setup runs, as the
  [git](/specs/decisions/git.md) decision asks of every worktree.

Changed by your answers since the rounds:

- **Nothing after the pull request**: the review of the built UI, from round 01's Q1 and Q1.A, is
  left out, as your note on "After the code" says.
- **No HTML fallback for stacks without Storybook**: they get a mockups Storybook in React with
  Astryx, as round 02's Q1 answer asks. HTML stays only for projects that decline a preview.

Settled while writing this spec:

- **How a story link names its story**: a path to the stories file, from the repository's root or
  relative to the file, then `#` and the export's name. The runner finds the index entry whose
  import path is that file and whose id ends with `--` and the export's id. Storybook builds ids
  from the export's name, so a renamed title still matches.
- **Where a mockups Storybook keeps its stories**: in the feature's `mockups/` folder, so they leave
  with the folder at finish, like HTML mockups. A project's own Storybook keeps them in its code.
- **What a frame may do.** The frame gets two sandbox flags, `allow-scripts` and
  `allow-same-origin`. Those are safe here because its origin is the Storybook's, not Uraeda's. It
  receives only:
  - its story's address;
  - its colour mode;
  - pick mode on or off.
- **The pick script** is one plain JavaScript file, for any Storybook framework:
  - it reports when it is ready, the story's height, and the picked element's role, accessible name,
    and text;
  - it handles Escape inside the frame;
  - Uraeda's own preview imports it from the skill, so there is no copy.
- **Comment text**: `Story <file name>#<export>`, then `, <role> “<name>”` when an element is
  picked, then `: ` and the text. It is anchored, as today's mockup comments are, on the embed's
  line.
- **In a round**, a comment on a variant is appended to its question's answer text as a line of its
  own.
- **Uraeda's Storybook data**: the server's Vite plugin runs inside Storybook's dev server over a
  fresh fixture repository, rather than from dehydrated snapshots. Stories need no extra step, and
  data still comes only from the server, through fate.
- **The width choice** is not kept: an embed opens at "Desktop" on wide screens and "Phone" on
  narrow ones.
- **The example** switches to stories: its spec links `/src/tasks/RepeatMenu.stories.tsx` exports,
  it gets a preview decision, and `mockups/repeat.html` goes. The tests that copied it use a fixture
  HTML mockup instead.
- **This repository's preview decision** names its folder and command in a rule. Its two frontmatter
  fields are added by the task that teaches the core to read them, since `ura check` refuses unknown
  fields until then.
- **The look-and-feel pass** is the first feature to use this. Nothing in it changes here.

## Decisions

New, applied when this spec is approved:

- [Preview](../decisions/preview.md): Uraeda's mockups and UI states are Storybook stories in
  `packages/web/src`. Its Storybook runs Uraeda's server over the fixture repository, its packages
  are pinned, its telemetry is off, its automatic story tests are off, and `vp run ready` builds it.

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): the server may run a project's preview command in a feature's
  worktree on its own port, without serving its files. The web UI may embed its stories, accepting
  messages only from their frames. See its
  [proposed change](../decisions/stack.md#proposed-change-2026-10-15-ui-iteration).

Relied on:

- [UI components](../decisions/ui-components.md): the embed, its toolbar, and its form are Astryx
  components. Stories follow the same lint rules.
- [UI layout](../decisions/ui-layout.md): embeds show both width classes. The comment form is a
  sheet on the phone.
- [UI behaviour](../decisions/ui-behaviour.md): the width choice saves at once, and the comment
  saves only by its button or Ctrl+Enter, with its unsaved text kept.
- [UI checks](../decisions/ui-checks.md): the embed's tests guard this spec's scenarios, and stories
  run as tests only when they guard one.
- [Agents](../decisions/agents.md): one session per feature, and the tests use the fake agent.
- [Git](../decisions/git.md): a worktree is set up before its code runs.
- [Code quality](../decisions/code-quality.md): splits come first, and no marker is added.
- [Toolchain](../decisions/toolchain.md): `storybook:build` is a cached task with its inputs.

## Constitution check

| Principle                                  | Complies | Notes                                                                                                          |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| I. Humans stay in control                  | yes      | The preview command runs only from an active, human-approved decision. Variants are picked by the human.       |
| II. Git and plain text first               | yes      | Stories are code in git, and links to them are plain markdown. Comments go to review files and answers.        |
| III. Asynchronous by default               | yes      | Every story, pick, and comment is committed. A Storybook is a process started again from the repository.       |
| IV. Review effort matches impact           | yes      | Mockups are tried in place, inside the spec, and comments point at the element.                                |
| V. Tools are optional                      | yes      | Links read on GitHub, and the decision's command runs Storybook by hand. The skill describes every step.       |
| VI. Code is checked and stays maintainable | yes      | Tests per scenario, `storybook:build` in `ready`, and splits before growth. The picked variant gets its tests. |

## Risk tier

**High**: the server starts project processes from a decision's command, and embeds code from
another origin. It also adds a large development dependency. No data users have changes.

## Details

### Data

- **`StoryLink`**, in the core:
  - `path`: the stories file, from the repository's root;
  - `export`: the export's name;
  - `label`: the link's text;
  - `block`: the paragraph's block id.

  A paragraph is an embed when it holds exactly one link, and nothing but whitespace around it. The
  link's path must end in `.stories.` and one of `js`, `jsx`, `ts`, `tsx`, `mjs`, or `svelte`, and
  its fragment must be a JavaScript identifier.

- **Every workflow file's view** gains `stories: StoryLink[]`, read by a new core module from the
  document tree. A spec's `mockups` also accepts story links in `## Mockups`. Links written from the
  repository's root are recognised there too.
- **The preview decision**, `specs/decisions/preview.md`, accepts two more frontmatter fields:
  - `preview-folder`: a folder of the repository;
  - `preview-command`: a command holding `{port}`.

  `ura check` reports a missing or wrong one, and these fields anywhere else. The core gives the
  server a feature's `Preview { folder, command }` from its worktree's copy of the decision, when it
  is `active`.

- **The preview runner's state**, in the server's memory, never stored, one per worktree:
  - `port`, `process`, and `lastView`;
  - `state`: `starting`, `ready`, or `failed`, with its last line of output.
- **A story's address**, sent to the UI by a fate query for one story link of one feature:
  - `state`: `none`, `starting`, `ready`, `missing`, or `failed`;
  - when ready, `frame`, `http://127.0.0.1:<port>/iframe.html?id=<id>&viewMode=story`;
  - and `storybook`, `http://127.0.0.1:<port>/?path=/story/<id>`;
  - when failed, `error`.

  The query updates live when the state changes.

- **Messages** between the embed and the pick script, all as objects with a `uraeda` field.
  - From the frame:
    - `{ uraeda: "ready" }`;
    - `{ uraeda: "size", height }`;
    - `{ uraeda: "picked", role, name, text }`;
    - `{ uraeda: "pick-stopped" }`.
  - To the frame, sent to the preview's origin:
    - `{ uraeda: "pick", on }`;
    - `{ uraeda: "mode", mode: "light" | "dark" }`.

### Components

- **The skill**:
  - [`spec.md`](/skills/uraeda/references/spec.md)'s Mockups:
    - with an active preview decision, mockups are stories, one export per state, each embedded by a
      link alone in its paragraph where it illustrates, and listed in `## Mockups`;
    - without one, HTML as today;
    - after a visual question, the spec's commit keeps the picked export and deletes the others.
  - [`discovery.md`](/skills/uraeda/references/discovery.md):
    - visual questions, their variants, and the test against sameness;
    - asking once for a preview decision.
  - [`plan.md`](/skills/uraeda/references/plan.md): a picked variant's component is the starting
    point, and its tests come before it is wired into the app.
  - [`projects.md`](/skills/uraeda/references/projects.md): the preview decision at setup:
    - a stack's own Storybook;
    - or a mockups Storybook in `storybook/`, React with Astryx, reading
      `specs/*/mockups/*.stories.tsx`.
  - [`conventions.md`](/skills/uraeda/references/conventions.md): story links, and the text of a
    comment on a story.
  - [`SKILL.md`](/skills/uraeda/SKILL.md): the folder layout's `mockups/` line.
  - New: `assets/templates/specs/decisions/preview.md`, and `assets/storybook/uraeda-pick.js`.
  - The example, as in [Assumptions](#assumptions).
- **The core** ([`crates/core`](/crates/core/)):
  - a new `files/stories.rs`: `story_links(document)`;
  - [`spec.rs`](/crates/core/src/files/spec.rs): story links and links from the root in
    `## Mockups`;
  - a new `files/preview.rs`: the decision's fields;
  - [`check/values.rs`](/crates/core/src/check/values.rs): the preview decision's fields;
  - a new `api/preview.rs`: `preview(folder)`.

  The views of workflow files carry `stories`.

- **The binding**: `preview(folder)`, and the `stories` field of views.
- **The server** ([`packages/server`](/packages/server/)):
  - `preview/runner.ts` (new):
    - starts the command in the worktree's folder, with `{port}` replaced by a free port, polling
      `index.json` every 500 ms for up to 2 minutes;
    - keeps the last 50 lines of output, retries once on a taken port, and restarts on demand;
    - stops a process group after 30 minutes without a view, when the worktree is removed, and at
      exit.
  - `preview/index.ts` (new): reads a ready Storybook's `index.json`, and matches a story link to an
    id.
  - fate: a `story` query of `{ folder, path, export }`, live, and a `preview.restart` mutation. A
    query counts as a view, and an embed on screen asks again every 5 minutes.
- **The web UI** ([`packages/web`](/packages/web/)):
  - `StoryEmbed.tsx` (new), with these parts:
    - the frame, with `title` set to the link's label and sandbox `allow-scripts allow-same-origin`;
    - at "Desktop", the frame is 1440 px wide, scaled to the column. At "Phone", it is 402 px wide.
      Its height comes from the `size` message, or is 560 px;
    - the toolbar: the label, an Astryx segmented control "Phone" and "Desktop", "Pick an element",
      "Comment", and "Open in Storybook". Narrow screens show them as named icon buttons;
    - the hint "Click an element to comment on it. Escape to stop.", and "Tap an element to comment
      on it." under a coarse pointer;
    - the comment form, reused from [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx), with the
      anchor "Comment on <label>" or "Comment on <label>, <role> “<name>”";
    - the states' texts from [Edge cases](#edge-cases), with "Try again" and "Open in Storybook"
      where the edge cases name them.
  - [`Blocks.tsx`](/packages/web/src/Blocks.tsx): an embed block draws `StoryEmbed`, after
    `BlockNode` is split.
  - [`Question.tsx`](/packages/web/src/Question.tsx): an option's embeds are drawn after its button,
    after `Question` is split. A comment there goes to the answer text.
  - [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx): after a split, its comments on embeds.
    [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx): a story's button scrolls to its
    embed.
  - The colour mode is sent to every frame when it changes.
- **Uraeda's Storybook**, `packages/web/.storybook/`:
  - `main.ts`: React and Vite, the stories of `src/**/*.stories.tsx`, telemetry off, and no
    automatic tests.
  - `preview.tsx`:
    - Astryx's three stylesheets, which also make StyleX's CSS load in a build;
    - the `Theme` wrapper, with its mode from the `mode` message;
    - the router and fate providers;
    - the pick script, imported from the skill.
  - The server's Vite plugin, in Storybook, over a fresh `fixtureRepo()` with the fake agent and
    `URA_TODAY=2026-10-16`.
  - The packages `storybook` and `@storybook/react-vite`, pinned at 10.6.2, and the package script
    `storybook`.
  - `StoryEmbed.stories.tsx` (new), the embed's states.
  - The toolchain: a `storybook:build` task in `ready`, whose inputs are:
    - `packages/web/src/**`;
    - `packages/web/.storybook/**`;
    - the pick script;
    - the lockfile.

    The Storybook cache folder is excluded.
- **This repository's preview decision**, [`preview.md`](../decisions/preview.md), with
  `preview-folder: packages/web`.

### Error handling

- **The command cannot start** (missing binary, failed install): the state is `failed`, with the
  last line it printed. The embed says "Storybook did not start: <line>".
- **No port is free after one retry**: `failed`, "No free port for Storybook."
- **The index is unreadable or not JSON**: `failed`, "Storybook's index could not be read."
- **The preview decision is invalid** in the worktree: no embed, and `ura check` names the problem.
- **A comment fails to save**: the form keeps its text, and shows the review's existing error, as
  comments do today.
- **A frame sends an unknown or malformed message**: it is ignored.

### Testing

The core's tests read fixture files, table-driven where there are many cases. The server's tests run
the preview runner on a fake preview: a small Node script in `fixtures/preview/`, which serves an
`index.json` and an `iframe.html` that loads the pick script. They use a fake clock. The browser
tests run the app in WebKit at both sizes, on a fixture repository whose preview decision runs that
fake preview.

| What                                                    | Test                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| US1.1, US1.7, SC-001, starting and ready                | Browser test: open a spec with an embed; one process for two pages; ready within 2 s          |
| US1.2, US1.5                                            | Browser test: the width control at both sizes, and the phone's named icons                    |
| US1.3                                                   | Browser test: "Open in Storybook"'s address                                                   |
| US1.4                                                   | Browser test: the `mode` message on load and on change                                        |
| US1.6, edge case: other workflow files                  | Browser test: an approved spec and a proposal with embeds                                     |
| US2.1–US2.6, SC-002                                     | Browser test: pick mode, Escape, both comment texts in `spec-review.md`, no pick script       |
| US3.1, US3.2, US3.4                                     | Browser test: a round with embeds under options, a comment into the answer, a removed variant |
| US3.3, US3.5, US4.1–US4.3, US4.5                        | Checked by review of the skill, its templates, and the example: the agents' own behaviour     |
| US4.4, the preview decision's fields                    | Core check test, table-driven: one row per field value                                        |
| Story links, SC-003, links in `## Mockups`              | Core test, table-driven: one row per paragraph, link, path, and fragment                      |
| US5.1                                                   | Checked by review: the decision's command run in `packages/web`                               |
| US5.2                                                   | The `storybook:build` task in `vp run ready`                                                  |
| US5.3                                                   | The `storybook:build` task, building `StoryEmbed.stories.tsx`                                 |
| Edge cases: failures, 2 minutes, port, index            | Server test: the runner on fake previews that fail, hang, or serve a bad index                |
| SC-005, edge cases: idle, server stop, `ura clean`      | Server test: the runner with a fake clock                                                     |
| SC-004                                                  | Server test: the preview's paths requested from Uraeda's port                                 |
| Edge cases: missing story, removed, no worktree, device | Browser test: each state's text                                                               |
| Edge case: messages from other frames                   | Browser test: a second frame and another origin posting `picked`                              |
| Edge case: no preview decision, plain links             | Browser test: a story link in a list item and without an export                               |
| Layout and axe checks                                   | The UI checks decision's runs, with a spec holding an embed added                             |
