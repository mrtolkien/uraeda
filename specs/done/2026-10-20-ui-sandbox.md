---
kind: feature
finished: 2026-10-20
pull-request: https://github.com/mrtolkien/uraeda/pull/52
---

# Record: Stable dev environment for UI review

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, in [its pull request](https://github.com/mrtolkien/uraeda/pull/52). Its full files are
> in git: `git log -- specs/2026-10-20-ui-sandbox/`.

## What and why

The human wanted to iterate fast on UI changes, in a "frozen" environment with a stable seed that
then "behaves normally". It runs the real code with hot reloading, like `vp run dev`. It holds mock
features at each step of the flow, changes, and sessions. An element picker sends what the human
points at to the agent, to ask for a change. `vp run sandbox` serves the whole app this way, beside
Storybook, which stays the place for mockups and variants.

## Behaviour

- **Browse every state (US1).** `vp run sandbox` serves the web app from the checkout it runs in,
  with hot reload, and prints `Sandbox: http://127.0.0.1:4410/`, or the next free port. Its list
  holds three projects, locked: "sample", "empty", and "broken". Every page carries an orange
  "Sandbox" badge in the bottom-left bar.
  - "sample" is the fixture's todo app, with a feature at each step: discovery, round waiting, spec,
    spec waiting, spec revision, approval, plan, plan waiting, plan revision, implementation, final
    review, pull request, pull request changes, finish, done, and blocked.
  - Its changes stand at work, at a waiting round, at finish with a draft pull request, with an open
    pull request, with changes requested, and done.
  - A fake `gh` lists six pull requests, for the features and changes at those steps.
  - The spec-waiting feature embeds stories, which run a fake Storybook.
  - "empty" is a project just set up: no feature, the templates' priorities and inbox.
  - "broken" has one feature per file of `fixtures/broken/`, each on its own branch, showing its
    `ura check` problem on Home. The spec missing its "User stories" is only a warning, and shows no
    problem.
- **Click through, and keep the state (US2).** Answers, approvals, and edits commit to the sample
  projects as to real ones. The projects, their list, and their sessions live in `.sandbox/` at the
  checkout's root, git-ignored, and survive restarts. `vp run sandbox --reset` rebuilds them.
  - A start whose sample builders changed since the build prints
    `The sample projects were built by older code: run with --reset to rebuild them.`, and keeps the
    state.
  - A `.sandbox/` deleted by hand, or left half-built by a killed seed, is built again.
  - Two seeds at once wait for each other on `.sandbox.lock`; a second reset rebuilds once more.
  - Commits are dated 2026-10-16, and "today" is fixed to that day; the browser's clock runs.
  - The sandbox never reads `.env`, and refuses to serve unless its repository, data, and config
    folders are inside a `.sandbox` folder.
  - It runs without sign-in, so an agent can open its pages directly.
- **Sessions in every state (US3).** Sessions run on a fake agent that runs nothing and changes no
  file.
  - At each start, the implementation feature's session is at work, streaming 40 tool calls over 10
    minutes. A restart stops it, and the turn plays again from its start.
  - Any other message gets "This is the sandbox's fake agent: it answers every message with this
    text, and changes no file.", streamed over 3 seconds. "Continue" on a feature gets it too, and
    the step does not move.
  - A message sent during a turn queues behind it, and messages cannot be taken back.
  - The sample's chats: one finished, one failed with an API error, one stopped, and one whose turn
    failed on the usage limit, its reason naming the limit.
- **Pick an element and paste it (US4).** "Pick an element" in the bar, or Alt+Shift+P anywhere,
  toggles pick mode. Alt+Shift+P is matched by its physical key, so it works on every layout and
  with Option on a Mac.
  - In pick mode, the element under the pointer is outlined, and clicks reach nothing in the page.
  - A click, or Enter or Space on the focused element, picks it and ends pick mode.
  - Escape ends pick mode, and the page gets no Escape: an open dialog stays open.
  - The bar, and anything inside `[data-uraeda-pick-ignore]`, is never outlined or picked.
  - A pick is copied at once, with no note form, and the bar reads
    `Copied button “Submit answers”. Paste it to your agent.`. When the browser refuses the
    clipboard, it reads `Could not copy. Select the text below and copy it.` over the text, selected
    whole when it takes focus.
  - The copied text has six lines: `Sandbox pick:` and the page's address, `Element:` and its role
    and name, and `Source:` with `path:line:column` from the repository's root. Then `Text:`, cut at
    200 characters with "…", `HTML:`, its source attributes removed and cut at 500, and
    `Viewport: <width> × <height>, <dark or light>`.
  - "Source" is the element's own location, else its nearest parent's, else `unknown`.
  - While a modal dialog is open, the bar moves into it, so it stays usable; picks work inside
    dialogs and open popover menus.
  - The "Sandbox" badge hides the pick toggle and the status line, and shows them again. Each
    viewer's choice is kept in `localStorage` as `uraeda.sandboxBar`. Hidden, the shortcut still
    picks, and a failed copy still shows its text.
  - The bar follows the app's light or dark mode.
- **Nothing ships.** The built app and the package hold no sandbox code, sample project, picker, or
  source attribute, as a test of the build's output checks.

## Design

The sandbox is the real server inside Vite's dev process, as the screenshot script runs it. It uses
the fake agent, a locked list, no sign-in, and folders inside `.sandbox/`. The picker reuses the
skill's pick script, which Storybooks load, so one script decides which element a click means.

- **The command**, [`sandbox/main.ts`](/packages/web/sandbox/main.ts), run by `vp run sandbox`. It
  seeds `.sandbox/`, puts the fake `gh` first on the `PATH`, and runs `vp run dev`'s
  [restart script](/packages/server/scripts/dev.ts) with the sandbox's Vite config. That script
  restarts the server on a server or Rust edit, as `vp run dev` does.
- **The Vite config**, [`vite.sandbox.config.ts`](/packages/web/vite.sandbox.config.ts). It checks
  the environment, serves the pick script from the skill at a path of its own, and adds the bar's
  entry to the page. Once Vite listens, it prints the address, and starts the server, which starts
  the turn at work.
- **Source locations**, [`sourceLocations.ts`](/packages/web/sandbox/sourceLocations.ts). A Vite
  plugin of ours calls code-inspector's core transform (`@code-inspector/core`, a development
  dependency). It adds a `data-insp-path` attribute to each element of the UI's components, with
  paths from the root of the checkout Vite serves. It runs before the UI's transforms, whose added
  lines would move every location.
- **The seed**, [`seed.ts`](/packages/web/sandbox/seed.ts). It holds a lock file, builds the
  projects in a temporary folder renamed into place, then lists them and seeds the sessions. Last,
  it writes a stamp: a hash of every file the builders read, which makes a later start stale.
- **The sample builders**, [`packages/web/samples/`](/packages/web/samples/index.ts), the one home
  of sample content for Storybook's fixture, the screenshots, and the sandbox:
  [`steps.ts`](/packages/web/samples/steps.ts) builds a feature per step from the files its step
  reads in the core, [`changes.ts`](/packages/web/samples/changes.ts) the changes, and
  [`projects.ts`](/packages/web/samples/projects.ts) the three projects.
- **The fake agent**, [`agent.ts`](/packages/web/sandbox/agent.ts), a `FakeAdapter` that answers
  with the canned reply and plays the turn at work for the implementation feature's message.
  [`sessions.ts`](/packages/web/sandbox/sessions.ts) seeds the sample chats through the session
  manager, so the runner alone writes their stored shape. The
  [fake adapter](/packages/server/src/runner/fake.ts) gained awaited steps and a fallback turn.
- **The pick script**, [`uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js), now also
  posts the source and HTML, picks by Enter or Space, and skips `[data-uraeda-pick-ignore]`.
- **The bar**, [`mountSandboxBar.tsx`](/packages/web/src/sandbox/mountSandboxBar.tsx) and
  [`SandboxBar.tsx`](/packages/web/src/sandbox/SandboxBar.tsx), in a React root of its own, in a
  manual popover that follows modal dialogs. [`pickText.ts`](/packages/web/src/sandbox/pickText.ts)
  owns the pick's text.

## Questions

### Round 01

#### Q1: Is the sandbox and the picker one feature, or two?

**Answer:** A: both in this feature, the sandbox first, so it works before the picker lands.

#### Q2: Where does the sandbox live?

**Answer:** A: a `vp run sandbox` command serving the whole app over sample projects, beside
Storybook, recorded in a new sandbox decision.

#### Q3: Where does a pick go?

**Answer:** C: copied to the clipboard, to paste anywhere: "Well I'll have to type text with the
pick anyways, it's ok if I need to paste it first".

#### Q4: How do agents behave inside the sandbox?

**Answer:** A: stored transcripts, and a fake agent answering any message with a canned reply,
streamed with delays, changing no file.

#### Q5: How long does the sandbox's state last?

**Answer:** A: in a git-ignored folder of the checkout, kept across restarts, until
`vp run sandbox --reset`.

#### Q6: Which states does the sample project hold?

**Answer:** A: three repositories: one with a feature at every step, changes, and sessions; an empty
project just set up; and one with broken files.

#### Q7: What does a pick tell the agent?

**Answer:** B: the element's role, name, text, HTML, page, and viewport, plus its source file and
line from code-inspector, in the sandbox only.

#### Q8: Does the sandbox need sign-in?

**Answer:** A: off, as an exception in the sign-in decision: "It's important that an agent can
easily access the HTML page. It's simpler."

## Decisions

- [Sandbox](../decisions/sandbox.md), new: the built UI is reviewed in a whole-app sandbox over
  sample projects and a fake agent, never the human's real data; Storybook stays the place for
  mockups.
- [Sign-in](../decisions/sign-in.md), changed: the sandbox joins tests and Storybook's fixture as an
  app code builds without sign-in.

## Changes after approval

- Building started on fix testing's local branch, merged in, before fix testing merged, as the human
  asked.
- Source locations come from code-inspector's core transform, in a plugin of our own, not its Vite
  plugin. That plugin always injects its client, an overlay and a chat of about 595 KB.
- The source plugin runs before the UI's transforms: after StyleX, every line was off.
- The skill's pick script picks by keyboard, Enter or Space, and skips the pick-ignore attribute. It
  also posts the source and HTML, and alone cuts the text at 200 characters with "…".
- Alt+Shift+P toggles pick mode, and the bar moves into an open modal dialog: the corner button
  alone could not start a pick inside a dialog or a popover menu.
- The "Sandbox" badge collapses the bar, remembered per viewer: on a phone, the bar covered the
  page's last controls.
- The usage-limited sample session is a failed turn whose reason names the limit, since the runner
  has no limited state.
- The broken sample features each stand on their own branch, so they show their problems. The one
  with a warning only shows no problem.
- The sample also has changes at finish and with changes requested on their pull requests.
- The sample's preview decision has no log file: one in a temporary folder would be gone when the
  sandbox starts its Storybook later.
- Seeds are serialized by a lock file: two resets at once removed each other's folder.
- The fake agent's close keeps the events it already wrote, which the benchmarks' tests rely on.

## Follow-ups

- Inbox, under deferred fixes: two seeds starting within the same 100 ms after a killed seed can
  both remove its stale lock, and both rebuild `.sandbox/`. The stale-lock recovery itself needs a
  lock.
- Not verified by hand: the page's hot reload on a component edit, and the restart on a server edit.
- Unverified: the clipboard in Safari after the pick script's `postMessage`.
- Icons render as empty boxes in headless WebKit's screenshots.
