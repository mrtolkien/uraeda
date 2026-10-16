---
status: approved
revision: 4
clarifications: 4
risk-tier: high
plan-review: false
---

# Spec: UI iteration flow

> [!NOTE]
>
> Approved on 2026-10-16, with round 04's answer: "C: Let's drop it for the moment, and add it as a
> "now" feature in priorities."
>
> - **US5's page shows Storybook's list of stories only.** Through Uraeda's sandbox, Storybook's dev
>   mode drops the messages between its interface and its story frame, so no story renders in it.
>   Fixing it needs Storybook's `insecureIframeMessaging`, left to a change in Now.
> - **No code changes for it.** The page, its rows, and "Open in Storybook" stay as built.

> [!NOTE]
>
> Approved on 2026-10-15.
>
> - **Round 03 answered C.** The preview paths keep their approved `Origin` rule until basic
>   security. Until then, any website open in your browser can read a running preview's code and use
>   Storybook's channel. The spec now says so, and the
>   [basic security draft](/specs/drafts/basic-security.md) holds the hole and the fix considered.
> - **A changed decision, stack.** Its consequence "Anyone who reaches the server reaches the
>   previews" becomes "any website open in the human's browser", as found. Its rules do not change.
> - **The review's other proxy findings** are in the details, as settled in round 03: upgrades only
>   as WebSocket GETs, no cookies or site-data clearing from Storybook, no `Connection`-named
>   headers, a guard pattern that needs a folder, headers on the proxy's own answers, and a
>   Storybook failed as soon as it exits.
> - **Tasks 1 to 6 are built.** The plan is revised after your approval, then the build goes on.

> [!NOTE]
>
> Approved on 2026-10-15.
>
> - **Phone and desktop.** On wide screens, an embed shows the story at both widths side by side,
>   each live and usable, with "Phone" and "Desktop" to see one alone. On a phone, it shows the
>   phone width only.
> - **The full Storybook.** A Storybook page in Uraeda shows Storybook's own interface for a branch.
>   Each embed's "Open in Storybook", the feature's page, and the session's column lead to it.
> - **C1: done.** A story link alone in an agent's message shows the story live in the chat, in a
>   feature's session and in a chat on the main checkout. It was not hard: Astryx's Markdown lets
>   the transcript replace a paragraph, so the chat reuses the spec's embed. The skill asks agents
>   to link the stories they write or change.
> - **C2: done.** Stories now come through Uraeda's own address, so they work from your phone
>   through Tailscale. Uraeda's server forwards `/r/<repository>/preview/<folder>/` to the branch's
>   Storybook. A spike checked this in WebKit and Chromium, hot reload included.
> - **The `Origin` rule is laxer, on those paths only.** It accepts `Origin: null` from the
>   sandboxed frames, for reads and live connections. Every other route keeps it, so a story still
>   cannot write anything through Uraeda's API.
> - **A new file for projects.** A project's Storybook loads a small helper from the skill, which
>   puts it under that path. Embeds need Storybook's Vite builder, its default for most stacks.
> - **Risk tier `high`.** The server starts project processes and forwards their traffic. The plan
>   does not wait for your review.

> [!NOTE]
>
> Changes requested on 2026-10-15: on desktop, both phone and desktop easy to see and test, phone
> behaviour on mobile; the full Storybook interface too; stories in the chat (C1); embeds working
> remotely through Tailscale, with a laxer `Origin` rule (C2).
>
> - **Your round 02 answer, as I read it.** Every project with a UI gets a Storybook: its own, when
>   its stack has one, otherwise a small mockups Storybook in React with Astryx, inside the project,
>   whose stories live in each feature's `mockups/` folder. HTML mockups stay only for projects that
>   decline.
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
project's Storybook. A link to a story, alone on its line in a spec, a question, or an agent's
message, shows the story running, at a phone and a desktop width. You comment on the whole story, or
on an element you pick inside it. A visual question offers variants as stories, and the one you pick
is the code that ships. Every project with a UI gets a Storybook, Uraeda's own included, with
stories fed by its real server. This answers the proposal's complaint that HTML mockups end up "far
from the actual results". See the [proposal](proposal.md), the discoveries [01](discovery-01.md) and
[02](discovery-02.md), and [03](discovery-03.md), and the clarifications [01](clarifications-01.md),
[02](clarifications-02.md), and [03](clarifications-03.md).

## User stories

The scenarios use Uraeda's repository, served as `uraeda`, and a future feature of it,
`2026-10-20-sidebar-resize`, checked out in `.worktrees/2026-10-20-sidebar-resize/`. Its stories are
in `packages/web/src/SidebarHandle.stories.tsx`, under the title `SidebarHandle`. A story's frame is
at `/r/uraeda/preview/2026-10-20-sidebar-resize/iframe.html?id=<id>&viewMode=story`.

### US1: See planned UI live in the spec (P1)

The human opens a spec, and each story it links stands where it is linked, running at a phone and a
desktop width. Storybook starts by itself the first time.

Why this priority: it is the proposal's core: validating behaviour and UX before the code, on the
real UI.

Acceptance scenarios:

1. **Given** Uraeda's preview decision is active, the spec of `sidebar-resize` waits for review, and
   under US1 a paragraph holds only
   `[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`, and the worktree's
   Storybook is not running, **When** the human opens the spec at 1440 × 900, **Then**:
   - the embed, titled "Dragging the handle", reads "Starting Storybook for this branch…";
   - the server runs the decision's command in `.worktrees/2026-10-20-sidebar-resize/packages/web`,
     with a free port of 127.0.0.1 in place of `{port}`, and `URAEDA_PREVIEW_BASE` set to
     `/r/uraeda/preview/2026-10-20-sidebar-resize/`;
   - once the Storybook's index lists the story, the embed shows the story `sidebarhandle--dragging`
     twice, side by side, both running: 402 px wide, unscaled, and 1440 px wide, scaled to the space
     left.
2. **Given** that embed, **When** the human presses "Desktop", **Then** only the desktop width
   shows, scaled to the reading column. "Phone" shows only the phone width, and "Both" brings both
   back. **When** they drag the handle in either frame, **Then** the story's own behaviour runs in
   that frame.
3. **Given** that embed, **When** the human presses "Open in Storybook", **Then** Uraeda's Storybook
   page opens, at `/f/2026-10-20-sidebar-resize/storybook?path=/story/sidebarhandle--dragging`.
4. **Given** Uraeda in dark mode, **When** the embed is ready, **Then** the story is drawn in dark
   mode, and switching Uraeda to light switches the story too.
5. **Given** a phone, 402 × 874, reaching Uraeda through a Tailscale host name listed in
   `URAEDA_ALLOWED_HOSTS`, **When** the same spec opens, **Then** the embed is as wide as the page
   and shows the phone width only. Its buttons are icons named "Pick an element", "Comment", and
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
   - the element under the pointer is outlined, in either frame;
   - clicks inside the story no longer act on it.
2. **When** they click the button "Hide the sidebar" in the phone frame, **Then** pick mode ends,
   and a comment form opens under the embed, reading "Comment on Dragging the handle, phone, button
   “Hide the sidebar”".
3. **When** they type "This should be an icon button." and press Ctrl+Enter, **Then**
   `spec-review.md` holds a comment on the embed's line, under "US1: Resize the sidebar (P1)", whose
   text is
   `Story SidebarHandle.stories.tsx#Dragging, phone, button “Hide the sidebar”: This should be an icon button.`
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
2. **Given** pick mode in option B's story, **When** the human picks the handle in its desktop frame
   and writes "Thicker grip.", **Then** Q2's answer text gets the line
   `Story SidebarHandle.stories.tsx#Grip, desktop, separator: Thicker grip.`
3. **Given** Q2 answered "A", **When** the agent writes the spec, **Then** the same commit deletes
   the `Grip` export from the stories file, keeps `ThinLine`, and the spec embeds
   `SidebarHandle.stories.tsx#ThinLine`.
4. **Given** that commit, **When** the human opens the answered round, **Then** option B's embed
   reads "This variant was removed after your answer."
5. **Given** the spec approved, **When** the plan is written, **Then** its first task for that view
   adds the tests of the view's scenarios, then wires the `ThinLine` component into the app.

### US4: See stories in the chat (P2)

The agent links the stories it wrote or changed in its messages, and each shows live in the session,
the same way as in a spec.

Why this priority: the human follows and steers agents in their sessions, before and after the pull
request.

Acceptance scenarios:

1. **Given** the session of `sidebar-resize`, **When** the agent's message holds a paragraph with
   only `[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)`, **Then** the
   transcript shows the embed, as in US1, from the feature's worktree.
2. **Given** a chat on the main checkout, **When** the agent's message holds such a link, **Then**
   the embed shows the story from the main checkout's Storybook, at `/r/uraeda/preview/main/`.
3. **Given** that embed in the session, **When** the human picks an element and writes "Larger hit
   area.", **Then** the composer's text gets the line
   `Story SidebarHandle.stories.tsx#Dragging, desktop, separator: Larger hit area.`, unsent.
4. **Given** a story link inside a sentence of the agent's message, **When** it shows, **Then** it
   is a link that opens Uraeda's Storybook page at that story.
5. **Given** the session's page at 1440 × 900, **When** the feature has an active preview decision,
   **Then** the session's column holds a "Storybook" row, which opens Uraeda's Storybook page.

### US5: Open the full Storybook (P2)

Uraeda's Storybook page shows Storybook's own interface for a branch: the list of stories, the
canvas, and Storybook's controls, inside Uraeda.

Why this priority: browsing every state and trying controls helps beyond the stories a spec links.

Acceptance scenarios:

1. **Given** `sidebar-resize`'s Storybook, **When** the human opens
   `/f/2026-10-20-sidebar-resize/storybook`, **Then** the page shows Storybook's interface from
   `/r/uraeda/preview/2026-10-20-sidebar-resize/`, as tall as the window, under the crumbs
   "sidebar-resize › Storybook".
2. **Given** `?path=/story/sidebarhandle--dragging` on that page, **When** it opens, **Then**
   Storybook shows that story.
3. **Given** the feature's page, **When** the feature has an active preview decision, **Then** it
   lists "Storybook", which opens that page.
4. **Given** a phone, **When** the page opens, **Then** it shows Storybook's own phone layout.

Until a later change, the page shows Storybook's list of stories, but its canvas and controls stay
empty: Storybook's dev mode drops the messages between its interface and its story frame, whose
sandbox gives it no origin
([round 04](clarifications-04.md#q1-how-does-storybooks-full-interface-work-inside-uraeda)).
Scenarios 1 and 2 hold for the page and its address; the story itself does not render.

### US6: Every project with a UI gets a Storybook (P2)

Setting up Uraeda in a project with a UI proposes a preview decision. A stack Storybook supports
uses its own Storybook. Any other stack gets a mockups Storybook, in React with Astryx, inside the
project.

Why this priority: the flow must work for every repository using Uraeda, whatever its stack.

Acceptance scenarios:

1. **Given** a project with a React and Vite UI, being set up, **When** the agent has proposed the
   code-quality decision, **Then** it proposes `specs/decisions/preview.md` from the template:
   - the project's own Storybook, in the folder that holds its UI, on Storybook's Vite builder;
   - a `preview-command` with `{port}` and `--host 127.0.0.1`;
   - the skill's helper in its `main.ts`, and the pick script in its preview.
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

### US7: Uraeda's own Storybook (P2)

Uraeda's states and mockups are stories in `packages/web`, fed by its real server over the fixture
repository, so a story shows what the app shows.

Why this priority: Uraeda is the flow's first user, and its look-and-feel pass the first feature to
need it.

Acceptance scenarios:

1. **Given** the repository, **When** the human runs the preview decision's command in
   `packages/web` with port 6006, **Then** Storybook lists every `*.stories.tsx` of
   `packages/web/src`, at `http://127.0.0.1:6006/`. Each story gets its data from Uraeda's server
   over a fresh copy of `fixtures/repo`, dated 2026-10-16, on the fake agent.
2. **Given** a story that does not compile, **When** `vp run ready` runs, **Then** the
   `storybook:build` task fails, naming the file.
3. **Given** this feature built, **When** Storybook opens, **Then** `StoryEmbed.stories.tsx` holds
   the embed's states: `Ready`, `Starting`, `Failed`, `Missing`, `Removed`, and `NoWorktree`.

## Edge cases

- **No active preview decision** in the checkout: a story link is a plain link, opening the file as
  code links do today. HTML mockups work as today. No "Storybook" row or page shows.
- **A story link inside a sentence or a list item**: a link to Uraeda's Storybook page at that
  story. Only a link alone in its paragraph embeds. `## Mockups` lists the stories as list items,
  and its buttons at the top of the review scroll to each story's embed.
- **A story link without `#Export`**: a plain link, opening the file.
- **Storybook fails to start**, or its process exits: the embed reads "Storybook did not start:
  <its last line of output>", with "Try again", which restarts it. The Storybook page shows the
  same.
- **Storybook not ready after 2 minutes**: "Storybook did not start within 2 minutes.", with "Try
  again".
- **The story is not in the index**: "No story “Dragging” in
  packages/web/src/SidebarHandle.stories.tsx on this branch.", with "Open in Storybook".
- **The story is missing from an answered round**: "This variant was removed after your answer."
- **The feature has no worktree**: "This feature has no worktree, so its stories cannot run here."
- **A project Storybook on the webpack builder**: the helper stops it at start with
  "uraeda-preview.js needs Storybook's Vite builder.", so the embed reads "Storybook did not start:
  uraeda-preview.js needs Storybook's Vite builder." The skill asks for the Vite builder.
- **Two features' stories open at once**: each checkout has its own Storybook, process, and path.
- **No view for 30 minutes**: the checkout's Storybook stops. The next view starts it again.
- **Uraeda's server stops**, or `ura clean` removes a worktree: its Storybook process stops with it.
- **A message from any window other than one of the embed's frames** is ignored.
- **A story's code requests any Uraeda route outside its own preview path**, or writes to its own
  path: the guard refuses it, since its origin is `null`.
- **A story whose frame never reports its height**: the embed is 560 px tall, and the story scrolls
  inside it.
- **The agent edits a story while it is embedded**: Storybook reloads it in the frame, through
  Uraeda's address, also from the phone.
- **A comment whose first line would start with `#` or `>`** cannot happen: the text starts with
  "Story ".
- **A story link in a proposal, a plan, or the notes of a round**: embedded the same way, in every
  workflow file the UI draws.

## Success criteria

- **SC-001**: With the checkout's Storybook running, an embedded story is ready within 2 seconds of
  its page opening, at both widths. Checked by a browser test on the fake preview.
- **SC-002**: Commenting on an element takes four actions: "Pick an element", a click, the text, and
  Ctrl+Enter. Checked by a browser test counting them.
- **SC-003**: A story link is a plain markdown link, readable on GitHub and in any editor, and
  `ura check` passes on a spec that holds one. Checked by a core check test.
- **SC-004**: A request with `Origin: null` reaches only `/r/<repository>/preview/` paths, and only
  as a read or a live connection. Every write and every other route refuses it. Checked by the
  guard's tests.
- **SC-005**: No Storybook process outlives 30 minutes without a view, or the server's stop. Checked
  by the preview runner's tests, with a fake clock.
- **SC-006**: An embedded story works the same from a listed host name as from 127.0.0.1. Checked by
  a browser test that opens the spec through `uraeda.test`, mapped to 127.0.0.1 and listed.

## Architecture

A planned view is a set of stories in a Storybook, which the project already has or gets, and which
Uraeda runs and forwards through its own address
([preview environment](discovery-01.md#a-preview-environment-in-every-project),
[Storybook 10](discovery-02.md#storybook-10)). Stories are code, so the picked variant is the code
that ships, which removes the drift between mockups and code
([pitfalls](discovery-01.md#known-complaints-and-pitfalls)). Each frame is sandboxed without its own
origin, so a story's code runs as `null`, which Uraeda's guard refuses everywhere but on its reads
under its own path. Products that run generated UI keep it apart from their host the same way
([running untrusted UI](discovery-02.md#running-untrusted-ui-next-to-a-host)).

A spike checked the forwarding:

- **The setup.** A Storybook 10.6.2 dev server ran on Vite+'s core, with StyleX, behind a proxy at
  `/r/repo/preview/feat/`.
- **What worked**, in WebKit and Chromium:
  - the story frame and Storybook's full interface;
  - hot reload, after an edit and after a new story;
  - frames sandboxed to `allow-scripts`;
  - a non-loopback host name.
- **What it took:**
  - Vite's `base` set to the path;
  - two script tags given the path;
  - Storybook's channel socket moved under the path;
  - `Access-Control-Allow-Origin: *` on the forwarded responses;
  - Vite's own live-reload socket forwarded with its full path.

**Units, and where each rule lives:**

- **The skill** owns how agents work:
  - mockups as stories, embedded where they illustrate;
  - visual questions and their variants, and keeping the picked one;
  - linking stories in messages;
  - the preview decision at setup.

  It ships the preview decision's template and two files for any project's Storybook:
  - `uraeda-preview.js`, the helper `main.ts` loads;
  - `uraeda-pick.js`, the pick script the preview loads.

  The [CLI](/specs/decisions/cli.md) decision requires the skill to carry every rule the tools
  follow.

- **The core** owns what a file says:
  - which links are story embeds: a link alone in its paragraph, to a `*.stories.*` file, with
    `#Export`;
  - the preview decision's two fields, and their check.
- **The server's preview runner** owns the processes:
  - starting the decision's command in a checkout, on a free port, with its path;
  - knowing when it is ready;
  - matching a story link to a story id in its index;
  - stopping it.
- **The server's preview proxy** owns the path `/r/<repository>/preview/<folder>/`. It forwards
  reads and live connections to the checkout's Storybook, and marks every response as sandboxed.
- **The guard** keeps its `Origin` rule everywhere else.
- **The web UI's story embed** owns the frames:
  - their widths, height, and colour mode;
  - pick mode, through `postMessage` with the pick script;
  - the comment.

  Specs, rounds, every workflow file, and the transcript draw it in place of the paragraph. The
  Storybook page frames Storybook's own interface.

- **Uraeda's Storybook**, in `packages/web/.storybook/`, loads the helper and wraps stories in the
  theme. It runs the server's Vite plugin over the fixture repository, so stories use the real fate
  client.

**Tradeoffs:**

- Uraeda forwards the traffic of Storybook processes, and the `Origin` rule is laxer on their paths.
  A story cannot write through Uraeda, nor read anything outside the preview paths. But any page can
  send `Origin: null`, so any website open in the human's browser can read a running preview and
  open Storybook's channel, until basic security
  ([round 03](clarifications-03.md#q1-how-do-previews-stay-out-of-other-websites-reach),
  [the hole](discovery-03.md#summary)).
- The helper reaches into two Storybook internals: the channel socket's path, and two script tags. A
  Storybook upgrade may break it. Its tests run on the pinned version, and the decision pins
  Storybook.
- Embeds need Storybook's Vite builder. Projects on its webpack builder must switch.
- Projects without a Storybook-supported stack get mockups in React with Astryx. Those mockups show
  behaviour and layout, but neither the project's look nor its code.
- Two frames per embed on wide screens run the story twice. The phone frame is cheap, and "Desktop"
  shows one.
- Several units need splitting first:
  - `ReviewPage` is at 99 of 100 lines, `BlockNode` at 92, and `Question` at 90;
  - `api.rs` is at its line baseline;
  - `document.rs` and `workspace.rs` may only shrink;
  - `createApp` is at 78 lines and gains the proxy, so it is split too.

  The embeds are read in a new core module, and reached through `api/*.rs`
  ([important reads](discovery-02.md#important-reads),
  [extract, don't grow](/skills/uraeda/references/code-quality.md#extract-dont-grow)).

## Mockups

- [Story embeds](mockups/story-embeds.html): the whole page, with a caption for each view:
  - a story embedded in a spec at 1440 × 900, at both widths;
  - pick mode and its comment form;
  - the embed's other states: starting, failed, missing, removed, no worktree;
  - a visual question with its variants;
  - a story in an agent's message, in a session;
  - Uraeda's Storybook page;
  - the phone at 402 × 874, with pick mode's comment sheet.

This mockup is HTML: Uraeda has no Storybook until this feature builds it. The embed's own states
become stories in US7.

## Assumptions

Settled in the clarifications ([round 01](clarifications-01.md#settled-without-the-human),
[round 02](clarifications-02.md#settled-without-the-human),
[round 03](clarifications-03.md#settled-without-the-human)):

- **When a question is visual**: only when seeing helps more than reading. Each one offers two to
  four distinct variants: if two could swap their text unnoticed, they are too alike. Each has a
  one-line tradeoff, with the recommended one first.
- **Widths**: 402 and 1440 px, Uraeda's two sizes, in Uraeda's colour mode.
- **Mixing variants**: an answer like "A, with B's grip" says it. There are no new mechanics.
- **One session makes the variants**, under the [agents](/specs/decisions/agents.md) decision. Its
  agent may use sub-agents.
- **Mockups are stories**, one export per state or variant, and the picked variant stays.
- **Uraeda runs the Storybook**, starting it on the first view of a checkout's story and stopping it
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
- **The proxy's narrower edges**, from the review of its first build: an upgrade counts as a read
  only as a GET asking for a WebSocket; Storybook's `Set-Cookie` and `Clear-Site-Data` are dropped;
  headers named in `Connection` are removed; the guard's pattern needs a folder, shared with the
  proxy; the proxy's own answers carry the CORS and sandbox headers; and a Storybook is failed as
  soon as it exits.

Changed by your answers since the rounds:

- **Nothing new after the pull request**, besides stories in the chat: the review of the built UI,
  from round 01's Q1 and Q1.A, is left out, as your note on "After the code" says.
- **The previews stay open to other websites until basic security**, as round 03's answer says. The
  [basic security draft](/specs/drafts/basic-security.md) records the hole and the fix considered: a
  random secret in every preview path.
- **No HTML fallback for stacks without Storybook**: they get a mockups Storybook in React with
  Astryx, as round 02's Q1 answer asks. HTML stays only for projects that decline a preview.

Settled while writing this spec:

- **How a story link names its story**: a path to the stories file, from the repository's root or
  relative to the file, then `#` and the export's name. The runner finds the index entry whose
  import path is that file and whose id ends with `--` and the export's id. Storybook builds ids
  from the export's name, so a renamed title still matches.
- **Where a mockups Storybook keeps its stories**: in the feature's `mockups/` folder, so they leave
  with the folder at finish, like HTML mockups. A project's own Storybook keeps them in its code.
- **The path of a checkout's Storybook**: `/r/<repository>/preview/<folder>/` for a feature's
  worktree, and `/r/<repository>/preview/main/` for the main checkout. Dated folder names cannot
  clash with `main`.
- **What a frame may do.** Every frame is sandboxed to `allow-scripts allow-popups`, without
  `allow-same-origin`, since it is served from Uraeda's own origin. Every forwarded response also
  carries a `sandbox` policy, so Storybook opened in a tab of its own runs as `null` too. A frame
  receives only:
  - its story's address;
  - its colour mode;
  - pick mode on or off.
- **The helper**, `uraeda-preview.js`, wraps a Storybook config when `URAEDA_PREVIEW_BASE` is set:
  - it sets Vite's `base` to the path;
  - it gives the path to the two script tags that ignore `base`;
  - it moves Storybook's channel socket under the path;
  - it points both live sockets at the page's own host and port, so hot reload follows the address
    the human used.

  Without the variable, it changes nothing, so `storybook dev` runs as usual. With it, on another
  builder than Vite, it stops Storybook with "uraeda-preview.js needs Storybook's Vite builder."
  Uraeda's own `main.ts` also gives the path to StyleX's stylesheet, which ignores `base`.

- **The pick script** is one plain JavaScript file, for any Storybook framework:
  - it reports when it is ready, the story's height, and the picked element's role, accessible name,
    and text;
  - it handles Escape inside the frame;
  - Uraeda's own Storybook imports both files from the skill, so there is no copy.
- **Comment text**: `Story <file name>#<export>`. When an element is picked,
  `, <phone or desktop>, <role> “<name>”` follows, the width only while both show. Then `: ` and the
  text. In a spec, it is anchored on the embed's line, as today's mockup comments are.
- **In a round**, a comment on a variant is appended to its question's answer text as a line of its
  own. **In a session**, it is added to the composer's text, unsent, so the human sends it when
  ready.
- **Uraeda's Storybook data**: the server's Vite plugin runs inside Storybook's dev server over a
  fresh fixture repository, rather than from dehydrated snapshots. Stories need no extra step, and
  data still comes only from the server, through fate.
- **The width choice** is not kept: an embed opens at "Both" on wide screens, and at the phone width
  on narrow ones, which have no width choice.
- **The Storybook page** is a page of its own, since the human stays in it, with no column, as the
  [UI layout](/specs/decisions/ui-layout.md) decision has a view the human stays in. Its frame is as
  tall as the window under the top bar.
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
  `packages/web/src`. Its Storybook loads the skill's helper and pick script, runs Uraeda's server
  over the fixture repository, is pinned with telemetry and automatic story tests off, and is built
  by `vp run ready`.

Changed, applied when this spec is approved:

- [Stack](../decisions/stack.md): the server may run a project's preview command in a checkout, and
  forward its reads and live connections under `/r/<repository>/preview/<folder>/`. Those paths
  accept `Origin: null`, and every other route keeps the rule. The web UI embeds stories in
  sandboxed frames, accepting messages only from them. See its [rules](../decisions/stack.md#rules).
  Its consequence on who reaches the previews now names any website open in the human's browser. See
  its [consequences](../decisions/stack.md#consequences).

Relied on:

- [UI components](../decisions/ui-components.md): the embed, its toolbar, and its form are Astryx
  components. Stories follow the same lint rules.
- [UI layout](../decisions/ui-layout.md): embeds show both widths on wide screens and the phone's on
  narrow ones. The comment form is a sheet on the phone, and the Storybook page is a page of its
  own.
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
| IV. Review effort matches impact           | yes      | Mockups are tried in place, at both widths, and comments point at the element.                                 |
| V. Tools are optional                      | yes      | Links read on GitHub, and the decision's command runs Storybook by hand. The skill describes every step.       |
| VI. Code is checked and stays maintainable | yes      | Tests per scenario, `storybook:build` in `ready`, and splits before growth. The picked variant gets its tests. |

## Risk tier

**High**: the server starts project processes from a decision's command, forwards their traffic, and
relaxes its `Origin` rule on their paths. It also adds a large development dependency. No data users
have changes.

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
- **Agent messages** are not workflow files: the transcript recognises a story link with the same
  rule, through the binding's `storyLink(href)`, which the core implements, so the rule has one
  home.
- **The preview decision**, `specs/decisions/preview.md`, accepts two more frontmatter fields:
  - `preview-folder`: a folder of the repository;
  - `preview-command`: a command holding `{port}`.

  `ura check` reports a missing or wrong one, and these fields anywhere else. The core gives the
  server a checkout's `Preview { folder, command }` from that checkout's copy of the decision, when
  it is `active`.

- **The preview runner's state**, in the server's memory, never stored, one per checkout:
  - `port`, `process`, `base`, and `lastView`;
  - `state`: `starting`, `ready`, or `failed`, with its last line of output.
- **A story's address**, sent to the UI by a fate query for one story link of one checkout:
  - `state`: `none`, `starting`, `ready`, `missing`, or `failed`;
  - when ready, `frame`, `/r/<repository>/preview/<folder>/iframe.html?id=<id>&viewMode=story`, and
    `storybook`, `/f/<folder>/storybook?path=/story/<id>`;
  - when failed, `error`.

  The query updates live when the state changes.

- **Messages** between the embed and the pick script, all as objects with a `uraeda` field. The
  embed accepts a message only when its `source` is one of its frames' windows, since their origin
  is `null`.
  - From a frame:
    - `{ uraeda: "ready" }`;
    - `{ uraeda: "size", height }`;
    - `{ uraeda: "picked", role, name, text }`;
    - `{ uraeda: "pick-stopped" }`.
  - To a frame:
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
  - [`implementation.md`](/skills/uraeda/references/implementation.md) and the change flow's
    reference: link the stories written or changed, alone on a line, in the messages that report
    them.
  - [`projects.md`](/skills/uraeda/references/projects.md): the preview decision at setup:
    - a stack's own Storybook, on its Vite builder;
    - or a mockups Storybook in `storybook/`, React with Astryx, reading
      `specs/*/mockups/*.stories.tsx`.
  - [`conventions.md`](/skills/uraeda/references/conventions.md): story links, and the text of a
    comment on a story.
  - [`SKILL.md`](/skills/uraeda/SKILL.md): the folder layout's `mockups/` line.
  - New:
    - `assets/templates/specs/decisions/preview.md`;
    - `assets/storybook/uraeda-preview.js`;
    - `assets/storybook/uraeda-pick.js`.
  - The example, as in [Assumptions](#assumptions).
- **The core** ([`crates/core`](/crates/core/)):
  - a new `files/stories.rs`: `story_links(document)` and `story_link(href)`;
  - [`spec.rs`](/crates/core/src/files/spec.rs): story links, and links from the root, in
    `## Mockups`;
  - a new `files/preview.rs`: the decision's fields;
  - [`check/values.rs`](/crates/core/src/check/values.rs): the preview decision's fields;
  - a new `api/preview.rs`: `preview(checkout)`.

  The views of workflow files carry `stories`.

- **The binding**: `preview(checkout)`, `storyLink(href)`, and the `stories` field of views.
- **The server** ([`packages/server`](/packages/server/)):
  - `preview/runner.ts` (new):
    - starts the command in the checkout's folder, with `{port}` replaced by a free port and
      `URAEDA_PREVIEW_BASE` set to its path;
    - polls `index.json` every 500 ms, for up to 2 minutes;
    - keeps the last 50 lines of output, retries once on a taken port, and restarts on demand;
    - fails a Storybook as soon as its process exits, and stops its process group;
    - stops a process group after 30 minutes without a view, when the worktree is removed, and at
      exit.
  - `preview/index.ts` (new): reads a ready Storybook's `index.json`, and matches a story link to an
    id.
  - `preview/proxy.ts` (new), mounted at `/r/:name/preview/:folder/*`:
    - forwards GET and HEAD requests to the checkout's Storybook, without the path and with its own
      `Host`, and refuses other methods;
    - forwards WebSocket upgrades, only GETs asking for a WebSocket, keeping the full path for
      Vite's `vite-hmr` protocol and removing the path otherwise. It removes the `Origin` header,
      which Storybook's channel refuses as `null`;
    - removes hop-by-hop headers and the headers `Connection` names, both ways, and drops
      Storybook's `Set-Cookie` and `Clear-Site-Data`;
    - adds `Access-Control-Allow-Origin: *` to every response, its own answers included;
    - replaces Storybook's `Content-Security-Policy` with
      `sandbox allow-scripts allow-popups; frame-ancestors 'self'`;
    - answers "Storybook is not running for this branch." with 503 when nothing runs there.
  - [`guard.ts`](/packages/server/src/guard.ts): GET, HEAD, and WebSocket upgrades under
    `/r/:name/preview/:folder/`, a pattern shared with the proxy, accept `Origin: null`. Everything
    else is unchanged.
  - The Node server passes upgrade requests to the proxy. The dev server's
    [`dev.ts`](/packages/server/src/dev.ts) sends `preview` paths to Hono.
  - fate: a `story` query of `{ folder, path, export }`, live, and a `preview.restart` mutation. A
    query counts as a view, and an embed on screen asks again every 5 minutes. The Storybook page
    counts as a view too.
- **The web UI** ([`packages/web`](/packages/web/)):
  - `StoryEmbed.tsx` (new), with these parts:
    - the frames, with `title` set to "<label>, phone" and "<label>, desktop", and sandbox
      `allow-scripts allow-popups`;
    - on wide screens, "Both" shows the 402 px frame unscaled, next to the 1440 px frame scaled to
      the space left. "Phone" and "Desktop" show one, the desktop scaled to the column. Their height
      comes from the `size` message, or is 560 px;
    - on narrow screens, the 402 px frame only;
    - the toolbar: the label, an Astryx segmented control "Both", "Phone", and "Desktop" on wide
      screens, then "Pick an element", "Comment", and "Open in Storybook". Narrow screens show the
      three buttons as named icon buttons;
    - the hint "Click an element to comment on it. Escape to stop.", and "Tap an element to comment
      on it." under a coarse pointer;
    - the comment form, reused from [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx), with the
      anchor "Comment on <label>", followed by the width and the element when one is picked;
    - the states' texts from [Edge cases](#edge-cases), with "Try again" and "Open in Storybook"
      where the edge cases name them.
  - `StoryEmbed` takes where its comment goes: the spec's review, a question's answer, or the
    composer.
  - `StorybookPage.tsx` (new), at `/f/<folder>/storybook` and `/storybook` for the main checkout:
    - Storybook's interface in one sandboxed frame, as tall as the window, under its crumbs;
    - `?path=` passed to the frame;
    - the runner's states as in the embed.
  - [`Blocks.tsx`](/packages/web/src/Blocks.tsx): an embed block draws `StoryEmbed`, after
    `BlockNode` is split.
  - [`Question.tsx`](/packages/web/src/Question.tsx): an option's embeds are drawn after its button,
    after `Question` is split. A comment there goes to the answer text.
  - [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx): after a split, its comments on embeds.
    [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx): a story's button scrolls to its
    embed.
  - [`Transcript.tsx`](/packages/web/src/Transcript.tsx): Astryx `Markdown`'s `paragraph` override
    draws `StoryEmbed` for a paragraph whose only child is a story link, and its `link` override
    sends other story links to the Storybook page.
  - [`SessionAside.tsx`](/packages/web/src/SessionAside.tsx) and
    [`FeaturePage.tsx`](/packages/web/src/FeaturePage.tsx): a "Storybook" row. `FeaturePage` is
    already marked, so it is split first.
  - [`routes.tsx`](/packages/web/src/routes.tsx): the Storybook page's routes.
  - The colour mode is sent to every frame when it changes.
- **Uraeda's Storybook**, `packages/web/.storybook/`:
  - `main.ts`:
    - React and Vite, the stories of `src/**/*.stories.tsx`;
    - telemetry and automatic tests off;
    - wrapped by the skill's `uraeda-preview.js`;
    - StyleX's stylesheet path given to the base.
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
    - the two skill files;
    - the lockfile.

    The Storybook cache folder is excluded.
- **This repository's preview decision**, [`preview.md`](../decisions/preview.md), with
  `preview-folder: packages/web`.

### Error handling

- **The command cannot start** (missing binary, failed install): the state is `failed`, with the
  last line it printed. The embed says "Storybook did not start: <line>".
- **No port is free after one retry**: `failed`, "No free port for Storybook."
- **The index is unreadable or not JSON**: `failed`, "Storybook's index could not be read."
- **A forwarded request fails** because the process stopped: 503, "Storybook is not running for this
  branch.", and the embed shows "Try again".
- **The preview decision is invalid** in the checkout: no embed, and `ura check` names the problem.
- **A comment fails to save**: the form keeps its text, and shows the review's existing error, as
  comments do today.
- **A frame sends an unknown or malformed message**: it is ignored.

### Testing

The core's tests read fixture files, table-driven where there are many cases. The server's tests run
the preview runner and proxy on a fake preview: a small Node script in `fixtures/preview/`, which
serves an `index.json`, an `iframe.html` that loads the pick script, a module script, and a
WebSocket. They use a fake clock. The browser tests run the app in WebKit at both sizes, on a
fixture repository whose preview decision runs that fake preview. One validation script, run by hand
like the agent's, starts Uraeda's real Storybook through the proxy and checks a story renders and
reloads.

| What                                                                                           | Test                                                                                          |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| US1.1, US1.7, SC-001, starting and ready                                                       | Browser test: open a spec with an embed; both frames; one process for two pages; ready in 2 s |
| US1.2, US1.5                                                                                   | Browser test: "Both", "Phone", "Desktop", and the phone's single frame and named icons        |
| US1.3, US5.1, US5.2, US5.4                                                                     | Browser test: "Open in Storybook" opens the Storybook page at the story                       |
| US1.4                                                                                          | Browser test: the `mode` message on load and on change                                        |
| US1.6, edge case: other workflow files                                                         | Browser test: an approved spec and a proposal with embeds                                     |
| US2.1–US2.6, SC-002                                                                            | Browser test: pick mode in each frame, Escape, both comment texts, no pick script             |
| US3.1, US3.2, US3.4                                                                            | Browser test: a round with embeds under options, a comment into the answer, a removed variant |
| US4.1–US4.4                                                                                    | Browser test: a session and a main-checkout chat, on the fake agent's messages                |
| US4.5, US5.3                                                                                   | Browser test: the "Storybook" rows                                                            |
| US3.3, US3.5, US6.1–US6.3, US6.5                                                               | Checked by review of the skill, its templates, and the example: the agents' own behaviour     |
| US6.4, the preview decision's fields                                                           | Core check test, table-driven: one row per field value                                        |
| Story links, SC-003, `storyLink`, links in `## Mockups`                                        | Core test, table-driven: one row per paragraph, link, path, and fragment                      |
| US7.1                                                                                          | The validation script: Uraeda's Storybook through the proxy                                   |
| US7.2, US7.3                                                                                   | The `storybook:build` task in `vp run ready`                                                  |
| SC-004, edge case: a story's own requests                                                      | Guard test, table-driven: one row per method, path, and `Origin`                              |
| SC-006                                                                                         | Browser test: the spec through `uraeda.test`                                                  |
| The helper: base, script tags, sockets, other builders                                         | Test of `uraeda-preview.js`, table-driven: one row per Storybook config and variable          |
| The proxy: path, `Host`, CORS, CSP, sockets, 503, the dropped headers, WebSocket-only upgrades | Server test: requests and upgrades through the proxy to the fake preview                      |
| Edge cases: failures, 2 minutes, port, index                                                   | Server test: the runner on fake previews that fail, hang, or serve a bad index                |
| SC-005, edge cases: idle, server stop, `ura clean`                                             | Server test: the runner with a fake clock                                                     |
| Edge cases: missing story, removed, no worktree                                                | Browser test: each state's text                                                               |
| Edge case: messages from other windows                                                         | Browser test: a second frame posting `picked`                                                 |
| Edge case: no preview decision, plain links                                                    | Browser test: a story link in a list item and without an export                               |
| Layout and axe checks                                                                          | The UI checks decision's runs, with a spec holding an embed and the Storybook page added      |
