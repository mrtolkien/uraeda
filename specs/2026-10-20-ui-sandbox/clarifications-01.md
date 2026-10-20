---
status: answered
---

# Clarifications, round 01: Stable dev environment for UI review

> [!NOTE]
>
> Answered on 2026-10-20.
>
> - Verdict: worth building, with changes: most parts exist apart, but two active decisions stand in
>   the way. "Frozen" and "behaves normally" also pull against each other.
> - Two choices last beyond this feature: a whole-app sandbox beside Storybook, which the preview
>   decision once rejected. And sign-in turned off in it, which the sign-in decision does not allow.
> - Where a pick goes decides who "you" is: the Claude Code terminal you write from, or an Uraeda
>   session.
> - How agents behave in the sandbox, and how long its state lasts, work together.
> - A risk: a pick queue lets any program on your machine ask the agent for a code change.
> - Check the shared seed builder under "Check these": it overlaps the fix testing feature.

## Context

### Goal

The [proposal](proposal.md) asks for a sandbox to iterate fast on the UI. It is the real web UI,
hot-reloading from a checkout's code, over a frozen sample project. That project holds features at
every workflow step, changes, and sessions, and behaves normally once clicked. Inside it, you pick
an element and send it to an agent, which changes the code while the page reloads.

### Today

The parts exist, but apart:

| Part                    | Where it exists today                                                                                                                                                       | What is missing                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Real server over a seed | Uraeda's Storybook ([fixture.ts](/packages/web/.storybook/fixture.ts)), and the [screenshot script](/packages/web/scripts/screenshots.ts), which serves the whole app       | a command to browse the whole app                                    |
| Features at steps       | [`fixtures/repo`](/fixtures/repo/) and Storybook's [feature pages](/packages/web/.storybook/featurePages.ts): a round, a spec, a plan, implementation, a pull request, done | a bare proposal, revisions, final review, changes requested, changes |
| Sessions                | token counts only ([`recordRun`](/packages/server/src/testing.ts)); transcripts only while a script emits events                                                            | stored transcripts, an agent at work                                 |
| Fake agent              | [`FakeAdapter`](/packages/server/src/runner/fake.ts) answers only scripted turns                                                                                            | replies to whatever you send                                         |
| Element picker          | [`uraeda-pick.js`](/skills/uraeda/assets/storybook/uraeda-pick.js), inside story frames only; a pick becomes a comment                                                      | a picker over the app's pages, and a channel to an agent             |

Elsewhere, seeded environments give one command resetting to a deterministic state (Rails, Laravel,
Supabase). Pickers hand an element to an agent in three ways. The clipboard (react-grab), a queue
the agent waits on (react-grab's `pull`, Agentation's MCP server), or a built-in agent (Cursor's
Design Mode, VS Code's browser).

### Scope

The sandbox: its command, its sample project, its fake agent, and how its state is kept and reset.
The picker over the sandbox's pages, and the channel from a pick to an agent. Left out: changing the
real `vp run dev`, a picker in the installed app, and screenshots inside picks.

### Sources

- The dev server, the fake agent, the session cache, the seed builders, Storybook's seed, the
  screenshot scripts, and the pick script, linked above.
- The active decisions: [preview](/specs/decisions/preview.md),
  [sign-in](/specs/decisions/sign-in.md), [agents](/specs/decisions/agents.md),
  [stack](/specs/decisions/stack.md), and [distribution](/specs/decisions/distribution.md).
- The features in flight: fix testing and merge chats.
- Rails, Laravel, Supabase, demo modes, lazygit, gitoxide, GitHub Desktop, MSW, Mirage, Storybook,
  React Cosmos, and React 19's source locations.
- Pickers: react-grab, Agentation, code-inspector, Cursor, VS Code, Claude Code Desktop, and Vercel.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Is the sandbox and the picker one feature, or two?

The sandbox is useful without the picker. The picker could also work on `vp run dev`. The pick
script already outlines and picks elements, so the picker's cost is mostly its channel to an agent.
A spec of both holds about 6 stories, within what one review covers. More in
[discovery](discovery-01.md#scope).

Why it matters: one spec reviews them together, but the sandbox reaches you later.

- **A (recommended). Build the sandbox and the picker in this feature, in that order, so the sandbox
  works before the picker lands.**
  - [pro] one review, and the picker is designed against the sandbox it runs in.
  - [con] the spec is larger.
  - Why recommended: the picker is small once the sandbox exists, and you asked for both.
- **B. Build the sandbox here, and start the picker as its own feature afterwards.**
  - [pro] the sandbox arrives sooner, with a smaller spec.
  - [con] a second round of questions and a second spec for a small part.

**Answer:** A

## Q2: Where does the sandbox live?

Uraeda's Storybook runs the real server over a seed, and has whole-page stories: Home, a spec, a
round, a feature. The [preview decision](/specs/decisions/preview.md) chose Storybook for mockups,
and rejected "a `vp run preview` task serving the whole app over fixtures" because it held "pages
only, and no place for variants". The sandbox serves a different need: browsing the built app, not
picking between variants. The screenshot script already serves the whole app this way. More in
[discovery](discovery-01.md#where-the-sandbox-lives).

Why it matters: it becomes a decision every UI feature follows, and A revisits a choice the preview
decision recorded.

- **A (recommended). A `vp run sandbox` command serving the whole app over the sample project, from
  the checkout it runs in, beside Storybook. A new `sandbox` decision records it, and Storybook
  stays the place for mockups and variants.**
  - [pro] you navigate the whole app, with its sidebar, links, and live updates, as a user does.
  - [con] a second way to see states, beside Storybook's stories.
  - Why recommended: only the whole app shows how pages work together, which is what you review.
- **B. More whole-page stories in Storybook, one per state, opened full window.**
  - [pro] no new command and no decision change.
  - [con] each story is one page: links between pages do not navigate.
- **C. A sandbox mode in `vp run dev`, adding the sample project to your real repository list.**
  - [pro] one command for everything.
  - [con] sample and real data in one app, and the real data folder takes the sample's sessions.

**Answer:** A

## Q3: Where does a pick go?

You write from a Claude Code terminal, and Uraeda has its own sessions. Pickers elsewhere use three
channels:

- the clipboard (react-grab);
- a queue a command waits on, printing each pick for the agent's loop (react-grab's `pull`,
  Agentation's MCP server);
- an agent built into the page (Cursor, code-inspector's panel). The agent must edit the checkout
  the sandbox runs from, or the sandbox never shows the fix. Merge chats is still deciding what a
  chat may change on the main checkout. More in [discovery](discovery-01.md#where-a-pick-goes).

Why it matters: it decides which agents can receive picks, and what new surface the sandbox opens.

C can come on top of A or B.

- **A (recommended). The sandbox keeps picks in a queue, and `vp run sandbox:picks` waits for the
  next one and prints it as JSON. Any agent running in the same checkout loops on that command.**
  - [pro] works with Claude Code in your terminal, and with any other agent.
  - [con] the agent has to be told to run the loop, and a queue opens a new route (see Q8).
  - Why recommended: it matches how you work now, and stays agent-agnostic, as the constitution asks
    ([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)). A, with C on top.
- **B. A pick opens a new session in your running Uraeda, with the pick in its composer, unsent.**
  - [pro] dogfoods Uraeda's sessions, with their history.
  - [con] needs your real Uraeda running beside the sandbox, and a session working on the checkout
    the sandbox runs.
- **C. A pick is copied to the clipboard, to paste anywhere.**
  - [pro] nothing to set up.
  - [con] one paste per pick, and nothing tells the agent a pick arrived.
- **D. The sandbox has its own panel running a real agent on its checkout.**
  - [pro] pick, ask, and watch the reload on one page.
  - [con] a second chat UI to build, beside Uraeda's sessions.

**Answer:** C: Well I'll have to type text with the pick anyways, it's ok if I need to paste it
first

### Q3.B: Which session does a pick open?

Only if you picked B in Q3. A chat on the main checkout offers a change for any code change today
([rule 8](/skills/uraeda/SKILL.md#rules-for-agents)). A change works in its own worktree, which a
sandbox on the main checkout does not run.

Why it matters: it decides whether a pick bypasses the change flow, and where the sandbox runs.

- **A (recommended). A chat on the main checkout, allowed to make the UI change there, unlike other
  chats.**
  - [pro] the sandbox on the main checkout shows the fix at once.
  - [con] an exception to rule 8, while merge chats is deciding that rule.
  - Why recommended: a pick is a small, visible change, which you review in the page.
- **B. A new change, whose worktree runs its own sandbox.**
  - [pro] the change flow as it is, with its branch and pull request.
  - [con] a second sandbox per change, and the page you picked in never reloads.

**Answer:**

## Q4: How do agents behave inside the sandbox?

The sandbox's sessions run on an agent too: the feature sessions and chats you click through, not
the agent receiving picks. The fake agent answers only what a script queued. A real agent behaves
normally, but costs tokens and never answers twice the same way. This works with how long the
sandbox's state lasts, in Q5. More in [discovery](discovery-01.md#agents-in-the-sandbox).

Why it matters: it sets how far "behaves normally" goes, and whether the sandbox stays frozen.

- **A (recommended). Sessions start with stored transcripts, and the fake agent answers any message
  with a canned reply, streamed with delays. It changes no file.**
  - [pro] free, the same every time, and every session view has content.
  - [con] a step never moves on by itself: you see an agent at work, not its result.
  - Why recommended: you review how pages look and react, not what an agent writes.
- **B. As A, and starting a step makes the fake agent commit that step's canned files, like a round
  after discovery or a spec after answers.**
  - [pro] you click through the whole workflow, step after step.
  - [con] one scripted outcome to keep up per step.
- **C. The real agent, Claude Code, runs on the sample project.**
  - [pro] fully normal.
  - [con] costs tokens, slow, and never frozen.

**Answer:** A

## Q5: How long does the sandbox's state last?

Every click commits to the sample project: an answer, an approval, an inbox note. An edit to the
server's code restarts the process holding the sandbox, as `vp run dev` does. Storybook rebuilds its
seed at every start, so a restart forgets what you clicked to. Seeded environments elsewhere keep
state until an explicit reset (`db:reset`, `supabase db reset`). This works with how agents behave
in the sandbox, in Q4. More in [discovery](discovery-01.md#state-lifetime).

Why it matters: it decides whether a server change throws you back to the start mid-review.

- **A (recommended). The sample project and its sessions live in a git-ignored folder of the
  checkout, kept across restarts, and `vp run sandbox --reset` rebuilds them.**
  - [pro] a server edit keeps you where you were.
  - [con] a sample project built by older code needs a reset after its builder changes.
  - Why recommended: you review across many edits, and some are server edits.
- **B. Rebuilt in a temporary folder at every start, like Storybook.**
  - [pro] always the fresh seed, nothing to reset.
  - [con] every server edit loses your place.

**Answer:** A

## Q6: Which states does the sample project hold?

Today's seeds cover about half of a feature's [steps](/crates/core/src/steps.rs): a round, a spec, a
plan, implementation, a pull request, and done. They hold no change and no stored session. The
server already shows several repositories in its list, each its own project, so a scenario can be a
repository. An empty project serves the "Empty inbox" and onboarding items of your
[priorities](/specs/PRIORITIES.md). More in [discovery](discovery-01.md#which-states).

Why it matters: each state is upkeep as the workflow changes, and a missing state is one you cannot
review.

- **A (recommended). Three repositories. One holds a feature at every step, a change at each of its
  steps, and sessions in every state. One is an empty project, just set up. One has broken files.**
  - [pro] every page you work on has its states, the empty ones included.
  - [con] the most seed to keep up.
  - Why recommended: the empty and broken states are where UI reviews find the most gaps.
- **B. One repository, with a feature at every step, a change at each of its steps, and sessions in
  every state.**
  - [pro] the whole flow, with less upkeep.
  - [con] no empty project, no broken files.
- **C. Storybook's seed as it is today.**
  - [pro] nothing to build.
  - [con] half the steps missing, and no change or session.

**Answer:** A

## Q7: What does a pick tell the agent?

The pick script sends an element's role, accessible name, and text. Pickers elsewhere add the
component's source file and line. On React 19, that takes a build plugin injecting attributes
(code-inspector, MIT). Or it reads React's private debug data, which broke many tools when React
changed it. StyleX hashes class names, so they cannot be searched. Uraeda's UI texts are literals in
its components, which a search finds. More in [discovery](discovery-01.md#what-a-pick-holds).

Why it matters: it decides how fast the agent finds the code, and whether a dependency comes in.

- **A (recommended). The element's role, accessible name, text, a short HTML snippet, the page's
  address, the width and theme, and your note. The agent searches the code from them.**
  - [pro] no dependency, and nothing that breaks with React's private data.
  - [con] an element without text is harder to find.
  - Why recommended: it extends the existing pick, and Uraeda's texts make search reliable.
- **B. As A, plus the component's file and line, from code-inspector's Vite plugin in the sandbox
  only.**
  - [pro] the agent opens the file directly.
  - [con] a new dependency, and the line points at the component, not always the element.
- **C. As A, plus the file and line read from React's debug data in the browser.**
  - [pro] no build change.
  - [con] relies on React's private data, which already broke once.

**Answer:** B

## Q8: Does the sandbox need sign-in?

The [sign-in decision](/specs/decisions/sign-in.md) says sign-in "MUST NOT be turned off by a flag,
an environment variable, or a setting". Only code may build an app without it, for tests and
Uraeda's own Storybook fixture. The sandbox is built by code, like the screenshot script, but is
neither. Without sign-in, any program running on your machine could read and change the sample
project. With a pick queue (A in Q3), it could also post a fake pick the agent would act on.
Websites in your browser still could not: the server refuses other origins. More in
[discovery](discovery-01.md#sign-in-in-the-sandbox).

Why it matters: it changes an active security decision, or adds a sign-in to every fresh sandbox.

- **A (recommended). Off: the sandbox is built by code without sign-in, and the sign-in decision
  adds it to its exception, beside tests and Storybook.**
  - [pro] open the address and work, as with Storybook.
  - [con] any program on your machine could post a pick the agent would act on.
  - Why recommended: those programs can already edit your checkout directly.
- **B. On, with a fixed key printed when the sandbox starts.**
  - [pro] no decision change, and only you can post picks.
  - [con] a sign-in after every reset.

**Answer:** A: It's important that an agent can easily access the HTML page. It's simpler.

## Settled without the human

### Check these

- **One seed builder** serves Storybook, the screenshots, and the sandbox, instead of three copies
  of "a feature at a step". It builds on the fixture helpers that fix testing is rebuilding, so this
  feature's implementation starts after fix testing merges. See
  [discovery](discovery-01.md#overlaps-with-features-in-flight).
- **Sessions follow merge chats**: the seeded sessions use whatever shape merge chats lands first,
  since both change the session pages. See
  [discovery](discovery-01.md#overlaps-with-features-in-flight).
- **No screenshot in a pick**: a page cannot capture itself without a library or a screen-share
  prompt. The agent can open the sandbox's address itself. See
  [discovery](discovery-01.md#needs-no-choice).
- **Frozen dates, live clock**: commits are dated and "today" is fixed, as Storybook's seed does,
  but the browser's clock runs, so running turns tick. See
  [discovery](discovery-01.md#needs-no-choice).

### Behaviour

- **A visible marker** on every page says this is the sandbox, as demo modes do, so it is never
  mistaken for your real Uraeda. See [discovery](discovery-01.md#demo-modes).
- **The sample project's content** is the todo app of the skill's example and `fixtures/repo`, the
  same one the tests and Storybook use. See [discovery](discovery-01.md#important-reads).
- **Any checkout** runs its own sandbox, on a free port it prints, so a feature's worktree shows its
  own code. See [discovery](discovery-01.md#a-sandbox-in-a-worktree).
- **Picking** starts from a corner button or a keyboard shortcut, outlines the element under the
  pointer, and stops with Escape. A picked element opens a short note form, as story picks do. The
  keyboard path picks the focused element, as the UI behaviour decision asks. See
  [discovery](discovery-01.md#needs-no-choice).
- **Pull requests** show through a fake `gh`, as in Storybook's seed. See
  [discovery](discovery-01.md#important-reads).
- **The repository list is locked**: the sandbox never adds or removes a repository. See
  [discovery](discovery-01.md#important-reads).

### Under the hood

- **The sandbox's server** is `uraedaServer()` with the fake agent and a locked list, as the
  screenshot script does. Its data and config folders sit inside the sandbox's folder, and `.env` is
  ignored. See [discovery](discovery-01.md#important-reads).
- **Seeded sessions** are written through the session cache into the sandbox's own `runner.sqlite`,
  never into a repository, as the agents decision asks. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **The picker's script** is loaded only by the sandbox's config, never by the built app, so the
  installed Uraeda carries none of it. See [discovery](discovery-01.md#vite).

**Notes:**
