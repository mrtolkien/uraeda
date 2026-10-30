---
status: changes-requested
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Onboarding + README pass

> [!NOTE]
>
> Changes requested on 2026-10-30: 5 comments in spec-review.md.
>
> - You approve a short README opening with the dot banner, the user reference moved to `docs/`, and
>   building Uraeda moved to `CONTRIBUTING.md`. Home gets a Setup pane with "Set up with the agent",
>   and `ura status` lists the same missing files.
> - New decision, documentation: the README stays a short page for newcomers, the reference lives in
>   `docs/`, and the workflow's rules in the skill alone.
> - A project without `specs/` gets the Setup pane in place of today's "run ura init" warning.
> - A decision counts as done once its file exists, even while it is still `proposed`.
> - The build waits for the performance pass to merge, since both change how the composer is
>   pre-filled.
> - Risk tier `medium`, for the new field in the workspace's data and in `ura status --json`. The
>   plan does not wait for your review.

This feature makes Uraeda easy for a human to start with, as the [proposal](proposal.md) asks. The
README becomes a short, appealing page that says what Uraeda is, a workflow first, then a CLI, then
a web UI. Its reference moves to pages of its own. The web UI tells when a project lacks the files
its setup needs, and a button opens a session that writes them with the agent. The research is in
[discovery](discovery-01.md), and your answers in [clarifications](clarifications-01.md).

## Decisions

- **New: [Documentation](../decisions/documentation.md)**. The README holds only what a newcomer
  needs, reference for users lives in `docs/`, building Uraeda in `CONTRIBUTING.md`, and the
  workflow's rules in the skill alone.

Relied on:

| Decision                                       | What it means for this spec                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Agents](../decisions/agents.md)               | The setup session runs the user's own Claude Code, the only agent today                       |
| [Distribution](../decisions/distribution.md)   | No new channel: the skill installs with `ura install` or `npx skills add`, as today           |
| [Stack](../decisions/stack.md)                 | What "set up" means is computed once, in the core, for the CLI and the web UI                 |
| [Problems](../decisions/problems.md)           | The Setup pane is not a check result and draws no card: Home's cards still show problems only |
| [Preview](../decisions/preview.md)             | The Setup pane's states are stories written with the real components                          |
| [Testing](../decisions/testing.md)             | At the `early` stage, only the core's check is tested; the pane is reviewed in the sandbox    |
| [Sandbox](../decisions/sandbox.md)             | A sample project without `specs/` joins the sandbox                                           |
| [CLI](../decisions/cli.md)                     | `ura status --json` gains a field, kept stable for tools                                      |
| [UI components](../decisions/ui-components.md) | The pane is the shared `Pane`, and its fallback the shared message to copy                    |

## User stories

### US1: A visitor understands Uraeda from its README (P1)

A visitor opens the repository on GitHub. In a few minutes they learn what Uraeda is, see how a
feature goes through it, and know what to install, in which order, to start.

[Banner](mockups/banner-a-plain.svg)

The README reads, in order:

1. **The banner**: the dot tree and "URAEDA" in dots, as you picked, in a light and a dark file.
2. **A tagline**, then **what Uraeda is**: a workflow for coding agents, shipped as a skill; a CLI,
   `ura`, that checks and moves it; a web UI that drives it, sessions included.
3. **What it looks like**: the todo app's recurring tasks feature, from the proposal to the pull
   request, with one question and its answer, as today.
4. **Getting started**: install the skill, `ura`, Claude Code, then the web UI. Then add the
   repository, set it up with the agent, and write a first proposal.
5. **Learn more**: the skill, the example, the pages of `docs/`, and `CONTRIBUTING.md`.
6. **Inspirations**, **Project status**, and **License**, short.

Key scenarios:

1. **Given** a visitor on GitHub in its dark theme, **When** the README loads, **Then** the banner
   shows Catppuccin Mocha's green tree and light name, with the alt text "Uraeda".
2. **Given** a visitor who uses Codex, **When** they read what Uraeda is, **Then** it says the
   workflow works with any agent that reads Agent Skills. It adds that only the web UI's sessions
   need a local, signed-in Claude Code, for now.
3. **Given** a visitor without Claude Code, **When** they read getting started, **Then** it names
   Claude Code's paid plan and links its install page.

More scenarios:

1. **Given** Safari, set to dark while GitHub is light, **When** the README loads, **Then** the
   light banner shows, as GitHub's theme asks.
2. **Given** a screen reader, **When** it reaches the banner, **Then** it reads "Uraeda", and the
   tagline under it as text.

### US2: A user finds the reference they need (P2)

A user who wants a setting, a flag, or how to reach Uraeda from their phone follows the README's
links to a page of `docs/`. A contributor finds how to build and test Uraeda in `CONTRIBUTING.md`.

Every fact of today's README outside the four parts of US1 moves, unchanged unless it is wrong:

| Page                   | What it holds, from today's README                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `docs/install.md`      | `ura`'s installers, `ura install` and upgrade, Tab completion, the web UI's npm package and `devEngines` |
| `docs/web-ui.md`       | Starting it and its flags, sign-in, settings, proxies, sessions with Claude Code, the data folder        |
| `docs/cli.md`          | The `ura` commands, and `ura lsp` for editors                                                            |
| `docs/specs-folder.md` | The `specs/` folder's layout, changes, and the inbox                                                     |
| `CONTRIBUTING.md`      | Building the tools, the `vp` commands, `.env`, releasing, and the bundled fonts' licenses                |

Key scenarios:

1. **Given** a user who wants their phone to reach Uraeda, **When** they follow the README's link to
   the web UI page, **Then** it shows `allowed_hosts`, `--allowed-hosts`, and the Caddy line.
2. **Given** a contributor, **When** they open `CONTRIBUTING.md`, **Then** it lists `vp install`,
   the binding's build, `vp run fast`, `vp run ready`, `vp dev`, and `vp run release`.

### US3: Home shows what the project lacks (P1)

A human adds a repository set up by `ura init` alone. Home opens with a Setup pane, first. It lists
each file the setup needs, written or not, and goes away once the required ones are written.

[After ura init](/packages/web/src/home/Setup.stories.tsx#AfterInit)

[One file left](/packages/web/src/home/Setup.stories.tsx#OneLeft)

[Without specs/](/packages/web/src/home/Setup.stories.tsx#NoSpecs)

The items, in the skill's order of setup:

| Item                  | Required | Done when                                                      |
| --------------------- | -------- | -------------------------------------------------------------- |
| specs/ folder         | yes      | `specs/` exists; listed only while it does not                 |
| Constitution          | yes      | `specs/CONSTITUTION.md` exists, and is no longer the template  |
| Code-quality decision | yes      | `specs/decisions/code-quality.md` exists                       |
| Testing decision      | yes      | `specs/decisions/testing.md` exists                            |
| Preview decision      | optional | `specs/decisions/preview.md` exists; never keeps the pane open |

A constitution is still the template while its title, a principle's name, a rule, or a date is a
bracketed placeholder, like `[Project]` or `[YYYY-MM-DD]`. The pane's count is the required items
left.

Key scenarios:

1. **Given** a repository after `ura init`, its constitution the template and `specs/decisions/`
   empty, **When** Home opens, **Then** the Setup pane comes first, counting 3. It shows
   "Constitution · still the template", "Code-quality decision · missing", "Testing decision ·
   missing", and "Preview decision · optional".
2. **Given** that repository, **When** the constitution, `code-quality.md`, and `testing.md` are
   committed, **Then** the Setup pane leaves Home, without a reload.
3. **Given** a repository without `specs/`, **When** Home opens, **Then** it shows the Setup pane
   alone, counting 4, its first item "specs/ folder · missing".

More scenarios:

1. **Given** a constitution whose first principle is written and second still "[Principle name]",
   **When** Home opens, **Then** it reads "Constitution · still the template".
2. **Given** a testing decision still `proposed`, **When** Home opens, **Then** it reads "Testing
   decision · written".
3. **Given** a project whose required files are written and which has no preview decision, **When**
   Home opens, **Then** there is no Setup pane.

### US4: The agent sets the project up (P1)

From the Setup pane, the human presses "Set up with the agent". The New page opens with the setup
message in its composer, unsent. They send it, and the agent writes the missing files with them,
following the skill's setup.

[Without the agent](/packages/web/src/home/Setup.stories.tsx#WithoutAgent)

The message is:

```text
/uraeda Set this project up for Uraeda: write what is missing, ask me before writing the constitution, never overwrite a file.
```

Key scenarios:

1. **Given** the Setup pane and Claude Code found, **When** the human presses "Set up with the
   agent", **Then** the New page opens on a session, the message in its composer, and nothing is
   sent.
2. **Given** that composer, **When** the human presses Send, **Then** the session runs in the main
   checkout, and its commits land on the default branch.
3. **Given** a machine without Claude Code, **When** Home shows the Setup pane, **Then** it shows
   "Give this message to an agent in this repository:", the message, "Copy the message", and
   "Install Claude Code", linking Claude Code's setup page.

### US5: `ura status` lists what the project lacks (P3)

A human or an agent runs `ura status` in a project not yet set up, and reads the same missing items
as Home, after the list of features.

Key scenarios:

1. **Given** a repository after `ura init`, **When** `ura status` runs, **Then** its output ends
   with:

   ```text
   Setup: 3 files missing
     Constitution: still the template
     Code-quality decision: missing
     Testing decision: missing
   ```

2. **Given** the same repository, **When** `ura status --json` runs, **Then** its output has a
   `setup` field listing each item with its name, its state, and whether it is required.
3. **Given** a project whose required files are written, **When** `ura status` runs, **Then** it
   prints no Setup lines.

## Replaced behaviour

- **Without `specs/`, Home shows the warning "No specs/ folder in …. Set Uraeda up with ura init."**
  Home shows the Setup pane instead; the Decisions page keeps a warning, which now says to set the
  project up from Home. No test checks the warning's text. The server's test "starting in a
  repository without specs/ adds it, given: %s" stays, since the workspace still says the folder is
  missing.
- **The README holds the whole reference.** Its install, web UI, CLI, editor, `specs/` folder, and
  build sections move as US2 says. No test guards them.

## Architecture

What "set up" means is computed once, in the core, and read by the web UI through the workspace, and
by `ura status`. The core's [placeholder rule](/crates/core/src/embedded.rs) already tells a
template's text, and the workspace's watcher already re-reads files as they land. The setup itself
stays the skill's: the button only hands the agent a short message naming it, as Claude Code's own
docs advise for pre-filled prompts
([discovery](discovery-01.md#products-that-set-a-project-up-with-an-agent)).

- **The setup check**, in the core, reads a repository and returns each item with its state and
  whether it is required. It owns which files the setup needs and when a constitution is still the
  template. It works without `specs/`.
- **The workspace view** carries the check's items, with or without `specs/`.
- **The setup message**, with the server's other workflow messages, is the one text the button and
  the message to copy both use.
- **The Setup pane**, on Home, draws the items and the button, first among Home's panes, or alone
  without `specs/`. It is the [mockups'](/packages/web/src/home/Setup.tsx) component.
- **`ura status`** prints the check's items after its list, and in `--json`.
- **The README, the pages of `docs/`, and `CONTRIBUTING.md`**, with the banner's light and dark SVG
  files under `docs/images/`.
- **The sandbox** gains a sample project without `specs/`.

Tradeoffs:

- The list of setup files is a second copy of the skill's setup steps, in the core. The core's code
  links the skill's section, and a change to the setup changes both.
- The button opens the New page rather than starting the session, so setting up takes one more
  press, Send.
- A flag or a setting now has its words in two places, the code's help and its page of `docs/`.

## Edge cases

| Importance | Situation                                            | What happens                                                                   |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| High       | `CONSTITUTION.md` exists and is written              | The message forbids overwriting, and the skill's setup keeps it as it is       |
| High       | A constitution half written, one placeholder left    | "Constitution · still the template"                                            |
| Normal     | A decision file exists but is `proposed`             | It counts as written                                                           |
| Normal     | `specs/` exists without `decisions/`                 | The three decisions read "missing", with no error                              |
| Normal     | A file lands while Home is open                      | Its item turns written, announced as a polite status; the pane goes when done  |
| Normal     | Claude Code is installed but signed out              | The button shows; the session's reply fails as any session's does today        |
| Normal     | The human edits the message before sending           | Their text is sent, as in any composer                                         |
| Niche      | A preview decision saying the project has no preview | It counts as written; the item is optional anyway                              |
| Niche      | A visitor reads the README on npm or crates.io       | Not shown there: the npm package has its own README, and no crate is published |

## Success criteria

- **SC-001** (short README): the README holds at most 1,000 words, banner to license.
- **SC-002** (nothing lost): every fact of today's README is in the README, a page of `docs/`, or
  `CONTRIBUTING.md`, and every link resolves.
- **SC-003** (two presses): from Home after `ura init`, a sent setup message takes two presses: "Set
  up with the agent", then Send.
- **SC-004** (one answer): `ura status` and Home list the same items for every sample project.
- **SC-005** (the check's cases): the core's check gives the right states for a missing `specs/`,
  the template, a half-written constitution, a written one, and each decision present or absent.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **A decision counts as written** once its file exists, whatever its status: the skill's setup
  leaves it `proposed` until you approve it, and the pane would otherwise stay. See
  [the setup](/skills/uraeda/references/projects.md#setting-up-a-project).
- **The pane's tone is "needs you"**, orange, since only the human can write a constitution. See
  [look and feel](/specs/ui/look-and-feel.md).
- **The pane lists written items too**, with a check, as GitHub's community checklist shows added
  files. See [discovery](discovery-01.md#products-that-check-a-projects-setup).
- **The banner's files** live in `docs/images/`, drawn from your pick in Catppuccin Latte and Mocha
  colours. The other two prototypes are deleted at approval.
- **`docs/` holds two internal notes today**, the CI reliability notes and a testing review. They
  stay where they are; the README links only the user pages.
- **`AGENTS.md`** says where the README's reference went, so agents follow the new decision.
- **The npm package's README** keeps its few lines, with its links checked.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: no stored data changes, but the workspace's data and `ura status --json` gain a field
that tools read.
