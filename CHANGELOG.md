# Changelog

## 0.8.0 - 2026-10-19

### Features

- **[Storybook's full interface in Uraeda](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-access-storybook.md)**
  ([#29](https://github.com/mrtolkien/uraeda/pull/29)): Uraeda's Storybook page framed Storybook's
  full interface for a checkout, its sidebar, canvas, controls, and panels, but rendered no story:
  since 10.6.2, Storybook pins its messages to an origin that Uraeda's sandboxed frame lacks. The
  human wanted "all of storybooks features when we need to", and asked whether basic security made
  it simpler. It did: basic security's frame secret removes the threat Storybook's origin check
  guards against, so one Storybook setting fixes the page.
- **[Redesign clarifications](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-clarifications.md)**
  ([#30](https://github.com/mrtolkien/uraeda/pull/30)): Rounds of questions had grown to 1.5 times
  the skill's example, opened by retelling the proposal, and read as a flat list on the page. The
  human asked for a round that is quick to read once, top to bottom: a verdict on the proposal and
  typed facts first, each question as a card with room for context, follow-ups set apart, settled
  points grouped by what to check, answers with a comment and no letter, and wording every model
  follows the same way.
- **[Redesign and reword specs](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-specs.md)**
  ([#33](https://github.com/mrtolkien/uraeda/pull/33)): Approving a spec is the human's most
  important job, and specs had become a sea of bullet points: 3,900 to 7,700 words, decisions buried
  after the stories, review comments answered by number, and decision links that opened the wrong
  branch. The human asked for a page approved in one sitting, without any other context: what is
  approved first, then the decisions with their changes marked in place, then the stories as cards,
  each part drawn for what it holds. Decisions had grown to 18,728 words, and the human wanted them
  short, intent first, with every line approved by a human.
- **[Redesign feature and change pages](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-redesign-feature.md)**
  ([#42](https://github.com/mrtolkien/uraeda/pull/42)): The feature page had grown by additions and
  showed neither where a feature was nor what it produced; a done feature showed one link to its
  record, and a change had no page at all. Two buttons opened the session and behaved differently,
  the only path to pull request feedback never fired, and "problems" flagged features that were
  fine. The human asked for one page that shows where a feature is, what's next, and what it
  produced, from proposal to merge.

### Changes

- **[Questions first](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-questions-first.md)**
  ([#32](https://github.com/mrtolkien/uraeda/pull/32)): The human wanted a round of questions to
  start with a list of all its questions, so they do not answer a later question early, in an
  earlier one's comment. Wide screens had the list in the column beside the questions, but on a
  phone it sat behind the top bar's "1/4" count, with no quick way to see the questions.
- **[Restart a Storybook when its checkout's commit changes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-storybook-restart.md)**:
  A checkout's Storybook was started once and kept until it idled out, failed, or "Try again" was
  pressed. After a commit that changed what Storybook reads only as it starts, its configuration and
  fixture in `.storybook/`, its dependencies, or the server code it runs, the embeds showed stale or
  blank stories: the round mockups of the clarifications redesign rendered blank, since their
  Storybook had started before the commit that added their fixture.
- **[Share the main checkout's builds with new worktrees](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-symlinks.md)**
  ([#28](https://github.com/mrtolkien/uraeda/pull/28)): Every new worktree built its Rust code and
  reran its checks from scratch: each compiled every dependency again, for 11 to 15 GB of `target/`
  each, and its first `vp run ready` replayed nothing. The human asked to link the `node_modules`
  and Rust build folders, "and everything that makes sense", into the worktrees, to save that CPU
  and storage.
- **[Decision review fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-decision-review-fixes.md)**
  ([#40](https://github.com/mrtolkien/uraeda/pull/40)): The review of
  [the specs redesign](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-17-redesign-specs.md)
  found flaws in how decisions are compared, commented on, checked, and sent live. This change fixes
  them, with a test for each.
- **[Diagram frames](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-diagram-frames.md)**
  ([#39](https://github.com/mrtolkien/uraeda/pull/39)): The diagrams of the web UI were drawn by
  Mermaid at its `sandbox` level, which was meant to keep a crafted diagram out of the app. It did
  not: a sanitizer bug would have run in a temporary frame with the app's origin. The proposal also
  listed small defects of the diagram's frames. The change removes the cause, and the defects with
  it.
- **[Priorities and decisions pages fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-priorities-decisions-fixes.md)**
  ([#36](https://github.com/mrtolkien/uraeda/pull/36)): Three flaws of the priorities and decisions
  pages: a valid decision link could read as broken, Discard kept a priority's draft when its
  children had changed, and the decisions page ran one `git log` per decision while the watch read
  every decision on each pass.
- **[Round fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-round-fixes.md)**
  ([#43](https://github.com/mrtolkien/uraeda/pull/43)): Fifteen small defects found while reviewing
  the round page, its checks, and their tests: wording, warnings that misfired or were missing, a
  heading dropped without a word, duplicated readings, and tests that started from an old round
  format.
- **[Skill wording fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-skill-wording.md)**
  ([#35](https://github.com/mrtolkien/uraeda/pull/35)): The skill's references, templates, and
  example had drifted from the rules they state: sentences over 25 words, a few rules that disagreed
  with their template or example, a dead link, and a round with follow-ups the core cannot show. The
  human listed the fixes in one proposal.
- **[Spec page fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-spec-page-fixes.md)**
  ([#41](https://github.com/mrtolkien/uraeda/pull/41)): The review of the redesigned spec page left
  about twenty-five loose ends: spec items the core and the page dropped without a word, spec-page
  behaviour tested loosely or not at all, an answered review that disappeared after landing, and a
  reading place and an editor that undid or garbled what the reader did. The change closes each.
- **[Start a draft folder from its proposal](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-start-draft-folder.md)**
  ([#34](https://github.com/mrtolkien/uraeda/pull/34)): Starting a draft folder from its
  `proposal.md` (`specs/drafts/<slug>/proposal.md`), as the web UI does, started it as a file draft:
  only `proposal.md` moved, and the folder's `images/` stayed behind, breaking the proposal's image
  links.
- **[Storybook preview fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-storybook-fixes.md)**
  ([#37](https://github.com/mrtolkien/uraeda/pull/37)): Five loose ends of the Storybook preview,
  left as follow-ups by the change that restarts a checkout's Storybook when its commit moves: two
  restart rules that went wrong in rare sequences, and three gaps in what the tests and the
  validation script prove.
- **[Worktree toolchain fixes](https://github.com/mrtolkien/uraeda/blob/v0.8.0/specs/done/2026-10-18-worktree-toolchain.md)**
  ([#38](https://github.com/mrtolkien/uraeda/pull/38)): Validating in several worktrees at once went
  wrong in three ways: the main checkout's `ts:check` and `specs:check` missed their cache after any
  worktree edit, the sweep of temporary folders failed with `ENOTEMPTY`, and runs were killed with
  code 137.

## 0.7.0 - 2026-10-17

### Features

- **[Auth and login for basic security](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-basic-security.md)**
  ([#22](https://github.com/mrtolkien/uraeda/pull/22)): The human wanted to use Uraeda remotely,
  from a phone and a laptop, with "basic security": a single user, easy to sign in from several
  places, with a key that stays stable across restarts, "simple _but_ secure enough to start running
  uraeda on a public, internet-accessible server". Until then the server's only protection was its
  `Host` and `Origin` checks and the tailnet. It also had to close the hole the UI iteration flow
  left open on purpose: any website could read a running Storybook preview by sending `Origin: null`
  from a sandboxed frame.
- **[Redesign sidebars and global interface](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-redesign-interface.md)**
  ([#25](https://github.com/mrtolkien/uraeda/pull/25)): A functional pass over what every page
  shares: the sidebars, the navigation, and the agents' statuses, before the look and feel pass. The
  sidebar had to make the flow's hierarchy obvious, Inbox, Priorities, Changes, Features, and to
  tell the human when they are needed; the statuses were iffy, "waiting on you" before a run had
  fully ended, "pull request ready" before one was opened, and items that never followed the
  workflow showed. Git writes took seconds with no feedback.
- **[Redesign home, inbox, and priorities](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-redesign-priorities.md)**
  ([#26](https://github.com/mrtolkien/uraeda/pull/26)): A functional pass on the pages every piece
  of work starts from: home, the inbox, and the priorities. The most standard paths had to be the
  fastest, and looking at them had to help the human organize the remaining work: editing a priority
  took four clicks with its commit, a priority added from the phone's home took six taps to commit,
  running and drafted entries looked like the rest, the inbox and the priorities looked and behaved
  differently, and home was "a list of grey bullet points". The human also asked for a readable view
  of the constitution and decisions, and for the whole to be one coherent UI, obvious to newcomers.
- **[Settings page](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-settings-page.md)**
  ([#24](https://github.com/mrtolkien/uraeda/pull/24)): The human did not want important values,
  like allowed host names, set only by flags and `.env`, and needed a settings page anyway for the
  many settings to come: a model per step, run options, review settings. The page had to be "clean
  from the start", with categories and placeholders that show its structure. The settings live in "a
  simple format that can be backed up/added to dotfiles simply", flags still change them for a
  start, "useful for starting a server headless", and Uraeda's data, "it grew organically so far",
  was to be organized coherently.

### Changes

- **[Faster story embeds](https://github.com/mrtolkien/uraeda/blob/v0.7.0/specs/done/2026-10-16-storybook-warmup.md)**
  ([#23](https://github.com/mrtolkien/uraeda/pull/23)): Opening the settings page's spec froze the
  whole site: its 12 story frames loaded at once, about 1,800 requests through the server, while the
  worktree's Storybook was still starting. Story embeds now load their frames only once on screen,
  and a feature's Storybook starts before its stories are embedded. One Storybook per worktree
  stays, as the preview decision says: putting everything on the default branch until code was
  weighed and dropped, since redesign mockups edit existing components.

## 0.6.0 - 2026-10-16

### Features

- **[Testing review](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-14-testing-review.md)**
  ([#18](https://github.com/mrtolkien/uraeda/pull/18)): `vp run ready` runs after every task of a
  plan, and took about 2 minutes locally, rerunning every step one after the other: over a feature,
  an hour or more lost. CI took up to 15 minutes in one job, and failed about half the time, when "a
  CI failure MUST mean that there is an IMPORTANT bug to fix". The human asked for tests that are
  "useful AND fast AND accurate": only the checks a change can affect rerun, what can run in
  parallel does, tests are isolated and reproducible, coverage is measured, and every test, flaky
  ones above all, pulls its weight.
- **[Add a bugfixing/low impact change flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-add-bugfixing.md)**
  ([#19](https://github.com/mrtolkien/uraeda/pull/19)): A light flow for bug fixes and small
  changes, shorter than the feature flow but with the same code quality: no questions or spec by
  default, and an offer to upgrade a change that turns out too big. With the full flow, any small
  change took an hour or more with an agent, so about 24 small changes went straight to `main` in
  five days with no record, tests, or review, and the agent-written bug flow was never used. The
  human wanted it to "look and feel like a chat with a light structure on top: a file as input for
  context, optional clarifications rounds, and then implementation and a PR". The visual UI
  iteration flow the proposal also floated became its own draft,
  [UI iteration flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-ui-iteration.md).
- **[Inbox](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-add-scratchpad.md)**
  ([#20](https://github.com/mrtolkien/uraeda/pull/20)): A small, structured place to write down
  ideas and feedback while using the software: a feature is mostly good but has small things to fix,
  not enough to block its pull request, or unrelated to it, and they should be kept in the
  repository to treat later. Until now they were lines at the end of `PRIORITIES.md`, under
  `## Scratchpad`, which the tools ignored, and which "could become their priorities, or could go
  inside drafts, or could be fixed quickly without a full dev flow". The human wanted capture first,
  organization as a second step in the same feature, and the name "Inbox". Notes now live in
  `specs/INBOX.md`, apart from the priorities, "because they are _not_ priorities, by definition",
  grouped under categories the human names; this feature's finishing commit moved the scratchpad's
  notes there.
- **[Claude five-hour allowance](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-claude-usage.md)**:
  Implemented directly on main at the human's request. The sidebar's **Agents at work** section
  shows the account's remaining Claude five-hour allowance below its feature and sub-agent rows.
- **[UI iteration flow](https://github.com/mrtolkien/uraeda/blob/v0.6.0/specs/done/2026-10-15-ui-iteration.md)**
  ([#21](https://github.com/mrtolkien/uraeda/pull/21)): Agent-written code is often mostly right,
  but its UI needs many small, targeted fixes and visual feedback, and HTML mockups end up "far from
  the actual results". The human wanted a visual way to iterate: real, interactive mockups that
  "PROPERLY show how the feature will BEHAVE", shown inside the spec, A/B/C picks between visual
  variants, and precise comments, for every repository using Uraeda whatever its stack, and for
  Uraeda itself. Mockups became Storybook stories in the project's own code, which Uraeda runs and
  embeds live, so the picked variant is the code that ships.

## 0.5.0 - 2026-10-15

### Features

- **[Image attachments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-image-attachments.md)**
  ([#14](https://github.com/mrtolkien/uraeda/pull/14)): Chats, proposals, and reviews accept images,
  dropped anywhere on the page or picked with a dedicated button, because "screenshots are often
  useful!". The answers widened it to every text a human writes, added paste, and a Neovim command
  to paste from the clipboard. Since committed images live in git history forever, the human asked
  for "an efficient, highly compressed format, that still works well for screenshots": every image
  is re-encoded as WebP by the Rust core.
- **[Multi-repo server](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-13-multi-repo-server.md)**
  ([#12](https://github.com/mrtolkien/uraeda/pull/12)): The server served one repository, the folder
  it started in. The human wanted Uraeda to manage several repositories from one web UI, with a
  repository selector at the top left and any folder of the machine addable, since a packaged Uraeda
  needs a flow to pick its first repository anyway. Running the UI easily, with `npx`, was split
  into its own feature,
  [Run the web UI with npx](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md).
- **[Code quality and maintainability through the skill](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-code-quality-in-the-skill.md)**
  ([#13](https://github.com/mrtolkien/uraeda/pull/13)): The human wants high-quality, maintainable
  apps with the least work, without reading a line of code. Research and a review of this repository
  showed agents grow and copy code feature after feature, held back by instructions alone, and that
  specs of 431 to 719 lines bury what the human must approve. This feature puts the human's part of
  a spec first and folds the build details in the web UI, writes a few code-quality concepts into
  the skill, each backed by a check, pushes every project to set those checks up, makes `SKILL.md` a
  lean entry point, and turns plan review off by default. This repository adopts the checks itself.
  The maintenance flow, an audit the human answers like a round of questions, was left for its own
  feature.
- **[Run the UI easily](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md)**
  ([#17](https://github.com/mrtolkien/uraeda/pull/17)): The web UI only ran from a checkout of
  Uraeda, with Rust, Node, pnpm, and a build. The human asked for the best and simplest way to
  package Uraeda today, so anyone can run it with one command, and for every promising solution to
  be tested: a single binary, a desktop app, or `npx uraeda`. Three were built and run during
  discovery: an npm package (3.5 MB, needs Node 24), a Node single executable (159 MB), and a Bun
  one (90 MB). The human chose the npm package.
- **[Dedicated session view](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-session-view.md)**
  ([#15](https://github.com/mrtolkien/uraeda/pull/15)): Following what an agent does is one of the
  main things the web UI is for, and a feature's session was a pane 40 % wide beside the feature
  page on a desktop, about 480 px of a 1440 px window: "it's hard to really follow what is happening
  at the moment". The session became a page of its own at every width, with a column beside the
  transcript for the feature's progress and the files changed on its branch. The sidebar shows each
  feature by its slug and, during its implementation, its current task, "7/11", taken from the
  plan's checkboxes, so it shows whoever runs the agent, the UI or a terminal.
- **[Text inputs and comments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-text-inputs.md)**
  ([#16](https://github.com/mrtolkien/uraeda/pull/16)): Writing is most of what the human does in
  the web UI, and it did not feel solid: the round's notes lost letters and showed twice on the
  page, review comments lagged on long specs, and some fields saved as they were typed while others
  waited for a button. The human asked for every text field to save only with a button, and for
  comments on the points a round settled without them, written into its notes.
