---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Stable dev environment for UI review

> [!NOTE]
>
> Approved on 2026-10-20.
>
> - You approve `vp run sandbox`: the whole app, hot-reloading from its checkout, over three sample
>   projects and a fake agent, kept until a reset. Its picker copies an element with its source.
> - A new decision, the sandbox, records it beside Storybook, which stays the place for mockups.
> - The sign-in decision lets the sandbox run without sign-in: any program on your machine could
>   read and change its sample projects, which hold nothing real.
> - A new development dependency, code-inspector's Vite plugin, is unverified with Vite+, StyleX,
>   and the React Compiler. If it fails, picks lose their "Source" line.
> - Unverified: picking over the app's open dialogs and popovers. The plan checks it first.
> - You said you paste a pick before typing: a pick is copied at once, with no note form.
> - Risk tier `medium`. Building starts after fix testing merges, since both change the fixtures.

A sandbox to iterate fast on the UI. `vp run sandbox` serves the real web app, from the code of the
checkout it runs in, over sample projects with a feature at every workflow step, changes, and
sessions. Clicking through behaves normally, and the state stays until a reset. A picker copies an
element, with its page and source location, to paste into the agent working on the code. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## Decisions

- **New: [Sandbox](../decisions/sandbox.md)**. The built UI is reviewed in a whole-app sandbox over
  sample projects and a fake agent, never the human's real data. Storybook stays the place for
  mockups.
- **Changed: [Sign-in](../decisions/sign-in.md)**. The sandbox joins tests and Storybook's fixture
  as an app code builds without sign-in.

Relied on:

| Decision                                     | What it means for this spec                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| [Preview](../decisions/preview.md)           | the bar's mockups are stories; sample features with stories run the fake Storybook |
| [Agents](../decisions/agents.md)             | the fake agent runs every session; sessions live in the sandbox's data folder      |
| [Stack](../decisions/stack.md)               | the sample projects are real git repositories, read by the core                    |
| [Distribution](../decisions/distribution.md) | nothing of the sandbox reaches the package                                         |
| [UI behaviour](../decisions/ui-behaviour.md) | picking has a keyboard path, and errors show beside the bar, not in a toast        |

## User stories

### US1: Browse every state of the app (P1)

From any checkout, `vp run sandbox` prints the sandbox's address. It opens on the real app, with
three projects in its list, a "Sandbox" badge in the corner, and every page navigable.

[The bar at rest](/packages/web/src/sandbox/SandboxBar.stories.tsx#Idle)

Key scenarios:

1. **Given** a checkout whose sandbox was never built, **When** the human runs `vp run sandbox`,
   **Then** it builds the sample projects, and prints `Sandbox: http://127.0.0.1:4410/`.
2. **Given** the sandbox open, **When** the human opens the project list, **Then** it holds
   "sample", "empty", and "broken", and adds or removes none.
3. **Given** the "sample" project, **When** the human opens Home, **Then** it lists a feature at
   each step: discovery, round waiting, spec to write, spec waiting, spec revision, approval, plan,
   plan waiting, plan revision, implementation, final review, pull request, pull request changes,
   finish, done, and blocked.

More scenarios:

1. **Given** the "sample" project, **When** the human opens the changes, **Then** one is at work,
   one waits on its round, one has a pull request, and one is done.
2. **Given** the "empty" project, **When** the human opens it, **Then** it shows a project just set
   up: no feature, empty priorities, and an empty inbox.
3. **Given** the "broken" project, **When** the human opens it, **Then** its features show the
   problems `ura check` reports.
4. **Given** port 4410 is taken, **When** the sandbox starts, **Then** it prints the next free port.
5. **Given** the sandbox running, **When** the human edits a component, **Then** the page updates in
   place, as with `vp run dev`.

### US2: Click through, and keep the state (P1)

Answering, approving, and editing in the sandbox commit to its sample projects as they would to a
real one. The state stays across restarts, until the human resets it.

Key scenarios:

1. **Given** the round waiting in "sample", **When** the human answers and submits it, **Then** the
   feature moves to "spec to write", as in a real project.
2. **Given** that answered round, **When** the human edits the server's code and the sandbox
   restarts, **Then** the round is still answered.
3. **Given** that answered round, **When** the human runs `vp run sandbox --reset`, **Then** the
   sample projects are rebuilt, and the round waits again.

More scenarios:

1. **Given** the sandbox built before a change to its sample builders, **When** it starts, **Then**
   it prints `The sample projects were built by older code: run with --reset to rebuild them.`, and
   keeps the state.

### US3: Sessions in every state (P2)

The sample sessions show every state a session has, with their transcripts. Any message gets a
canned reply from the fake agent, which changes no file.

Key scenarios:

1. **Given** the sandbox just started, **When** the human opens the implementation feature's
   session, **Then** its agent is at work, streaming tool calls for 10 minutes, then ends done.
2. **Given** any session, **When** the human sends "Make the title bigger", **Then** the reply "This
   is the sandbox's fake agent: it answers every message with this text, and changes no file."
   streams in over 3 seconds.
3. **Given** the "sample" project, **When** the human opens its sessions, **Then** one is a finished
   chat, one at work, one failed, one stopped, and one stopped by the usage limit.

More scenarios:

1. **Given** a feature waiting on the agent, **When** the human presses "Continue", **Then** its
   session gets the canned reply, and the feature's step does not move.
2. **Given** the session at work, **When** the sandbox restarts, **Then** its interrupted turn shows
   as stopped, and the same turn plays again from its start.

### US4: Pick an element and paste it to the agent (P2)

The human turns on "Pick an element" in the sandbox's bar, and clicks an element. Its page, role,
name, source, text, HTML, and viewport are copied, to paste into the agent working on the checkout.
The agent can open the page's address itself, since the sandbox has no sign-in.

[Picking](/packages/web/src/sandbox/SandboxBar.stories.tsx#Picking)

[Copied](/packages/web/src/sandbox/SandboxBar.stories.tsx#Copied)

[Copy refused](/packages/web/src/sandbox/SandboxBar.stories.tsx#CopyFailed)

Key scenarios:

1. **Given** pick mode on, **When** the human clicks "Submit answers" on a round, **Then** pick mode
   stops, the bar reads `Copied button “Submit answers”. Paste it to your agent.`, and the clipboard
   holds the text below.
2. **Given** pick mode on, **When** the human presses Escape, **Then** pick mode stops, and the page
   gets no Escape.
3. **Given** the browser refuses the clipboard, **When** the human picks an element, **Then** the
   bar reads `Could not copy. Select the text below and copy it.`, with the pick's text under it.

The copied text, for the first scenario:

```text
Sandbox pick: http://127.0.0.1:4410/r/sample/f/2026-10-11-web-ui/round
Element: button “Submit answers”
Source: packages/web/src/RoundSubmit.tsx:215:11
Text: Submit answers
HTML: <button type="submit" class="x1n2onr6 x9f619">Submit answers</button>
Viewport: 1440 × 900, dark
```

More scenarios:

1. **Given** pick mode on, **When** the human hovers an element, **Then** it is outlined, and clicks
   reach nothing in the page.
2. **Given** pick mode on and a button focused, **When** the human presses Enter, **Then** that
   button is picked.
3. **Given** an element without a source location of its own, **When** it is picked, **Then**
   "Source" is that of its nearest parent with one, or `unknown`.
4. **Given** pick mode on, **When** the human clicks the sandbox's bar, **Then** nothing is picked.

## Architecture

The sandbox reuses what the screenshot script and Storybook already do: the real server in Vite's
process, the fake agent, and dated sample repositories
([discovery](discovery-01.md#important-reads)). It adds a fixed folder, a session seed, the fake
agent's sandbox script, and a picker loaded only by its own page.

- **The sample builders** build "a feature at a step", a change at a step, and the three projects.
  They own the sample content and dates, and serve Storybook, the screenshots, and the sandbox.
  Storybook's own copy in `featurePages.ts` moves into them.
- **The sandbox seed** builds the sample projects and sessions into `.sandbox/`, at the checkout's
  root, git-ignored. It records the builders' version, and owns the reset.
- **The session seed** writes the sample sessions' transcripts into the sandbox's `runner.sqlite`,
  through the session cache.
- **The fake agent's sandbox script** gives the canned reply to any message, and replays the session
  at work at each start. It owns the canned text.
- **The sandbox command**, `vp run sandbox`, serves the app with the server on the fake agent, a
  locked list, no sign-in, and its data and config folders in `.sandbox/`. It ignores `.env`, fixes
  "today", and puts the fake `gh` first. It restarts on server and Rust changes with `vp run dev`'s
  logic.
- **The picker** is the bar, pick mode over the page, and the pick's text. It owns the pick's
  format, and shares the pick script's rules for which element a click means and its role and name.
- **Source locations** come from code-inspector's Vite plugin, in the sandbox's config only, adding
  each element's source as an attribute, without its own overlay or server.

Tradeoffs:

- A second way to see states, beside Storybook's stories.
- The sample projects need upkeep with each new step or file format.
- A step never moves on by itself: you see an agent at work, not its result.

## Edge cases

| Importance | Situation                                               | What happens                                                     |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| High       | `.env` points the server at the real data folder        | the sandbox ignores `.env`, and never opens the real data folder |
| High       | The sample builders changed since the sandbox was built | the start prints the reset hint, and keeps the state             |
| Normal     | Two checkouts run their sandboxes at once               | each has its own `.sandbox/` and port                            |
| Normal     | The browser refuses the clipboard                       | the bar shows the pick's text to copy by hand                    |
| Normal     | A picked element is inside an open dialog or popover    | it is picked like any other element                              |
| Normal     | Escape while a dialog is open in pick mode              | pick mode stops; the dialog stays open                           |
| Normal     | An element has no source location, nor any parent       | "Source: unknown"                                                |
| Normal     | A sample feature embeds stories                         | they run the fake Storybook, as in Storybook's seed              |
| Niche      | A text or HTML longer than its cut                      | text is cut at 200 characters, HTML at 500, each ending with "…" |
| Niche      | `.sandbox/` deleted by hand                             | the next start builds it again                                   |

## Success criteria

- **SC-001** (first start): A first `vp run sandbox` serves Home in under 60 seconds, a later one in
  under 15.
- **SC-002** (every step): Every feature step and every change step has a sample in "sample".
- **SC-003** (real data untouched): A sandbox run changes no file in the real data and config
  folders.
- **SC-004** (nothing shipped): The built app and the package hold no sandbox code and no source
  attributes.
- **SC-005** (one pick): From pick mode on, one click copies a pick.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there, except picking: your answer to where a pick goes removes the note form, since you
type your request after pasting.

Settled while writing this spec:

- **The projects' names** are "sample", "empty", and "broken"; "broken" reuses
  [`fixtures/broken/`](/fixtures/broken/).
- **The dates** stay Storybook's: commits dated 2026-10-16, and "today" fixed to that day.
- **The port** starts at 4410, away from the screenshots' 4390.
- **The bar** sits in the bottom-left corner, over the page without moving it, so layouts are
  reviewed as they are.
- **The pick's text** uses paths from the repository's root, and a viewport of width, height, and
  theme.
- **The session at work** replays one scripted turn of 10 minutes, since the fake agent runs one
  process at a time.
- **The reset** is a flag of the same command, `--reset`.
- **Merge chats**: the sample sessions follow whichever session shape is on the default branch when
  this feature is built.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: it changes a security decision, but only for a development app holding sample data, and
adds a development dependency.
