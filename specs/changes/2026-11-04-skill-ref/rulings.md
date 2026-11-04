# Rulings: Skill and web UI apart

The low-impact choices made while making [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: The web UI tells its own sessions what only it does

- **Decision**: the instructions only a web UI session needs, its offer blocks and cards, a
  session's move into a change's worktree, the `/f/<folder>` page to open, and what it shows of the
  agent's messages, leave the skill for
  [`instructions.ts`](/packages/server/src/runner/instructions.ts). The Claude adapter appends them
  to the system prompt of every process it starts, resumed ones included, with
  `--append-system-prompt`.
- **Rationale**: the skill is the workflow for any harness, as the constitution's principle V asks.
  A session the web UI runs still needs these instructions, so the web UI gives them itself. Where
  the two differ, the instructions say so: a yes in words gets the block again instead of a start.
- **Alternatives considered**: a second skill in the server's plugin folder, which the agent loads
  only when its description matches, so an offer could go unmade; a reference file in the skill that
  only web UI sessions read, which keeps both in one place, the mix the proposal rules out.
- **If wrong**: another agent's adapter must pass the same text its own way, or its sessions offer
  in words, which the card does not catch.
- **Where**: [`claude.ts`](/packages/server/src/runner/claude.ts),
  [`instructions.ts`](/packages/server/src/runner/instructions.ts)

## R2: What the web UI draws goes to its page of the documentation

- **Decision**: the skill's lines on what the web UI draws or does for the human, like folded
  scenarios, decision icons, the New page's starts, the inbox's buttons, and "Fix moved links", move
  to a new **The workflow's files** section and the **Sessions** section of
  [`docs/web-ui.md`](/docs/web-ui.md). Tool behaviour an agent must match, like the commit messages
  and the amended `chore:` commits, stays in the skill, said of `ura` and other tools.
- **Rationale**: the [documentation](/specs/decisions/documentation.md) decision puts reference for
  users in `docs/`, and an agent following the workflow acts on none of these lines.
- **Where**: [`docs/web-ui.md`](/docs/web-ui.md)

## R3: The preview's requirements stay in the skill, said of a tool that shows it

- **Decision**: setting up a project's preview keeps its requirements: Storybook's Vite builder,
  which `uraeda-preview.js` enforces, the two files of `assets/storybook/`, and data read by GET.
  What the web UI does with the preview is said of "a tool that shows the preview". The preview
  decision's template and the example's keep naming Uraeda, as a project's decision names the tool
  it relies on: the example's "Uraeda's helper" became `uraeda-preview.js`, the file that checks it.
- **Rationale**: an agent setting up a project must meet these requirements, in any harness, and the
  preview decision is a workflow file of the project, not an instruction of the skill.
- **Where**: [`projects.md`](/skills/uraeda/references/projects.md),
  [`spec.md`](/skills/uraeda/references/spec.md),
  [`conventions.md`](/skills/uraeda/references/conventions.md)

## R4: A test keeps the web UI out of the skill

- **Decision**: `the_skill_never_describes_the_web_ui`, in [`skill.rs`](/crates/cli/tests/skill.rs),
  fails when `SKILL.md`, a reference, a template, or an example file names the web UI: "web UI",
  "uraeda-offer", "in Uraeda", "Uraeda shows", or "Uraeda's helper". It caught a line of
  `decisions-check.md` the first pass missed.
- **Rationale**: the mix grew one line at a time, with each feature of the web UI; a review would
  miss the next one as easily.
- **If wrong**: a phrase the list lacks slips through; add it to the list.
- **Where**: [`skill.rs`](/crates/cli/tests/skill.rs)

## R5: The offer block's language has one home, in the server

- **Decision**: `OFFER_LANGUAGE` lives in
  [`instructions.ts`](/packages/server/src/runner/instructions.ts), and the web UI's
  [`offers.ts`](/packages/web/src/offers.ts) imports it. A web test reads the instructions' example
  offer with `lastOffer`, as the card would.
- **Rationale**: the instructions teach the block the card parses: a copy of the constant, or an
  example the parser does not read, would let the two drift apart.
- **Where**: [`offer-instructions.test.ts`](/packages/web/src/__tests__/offer-instructions.test.ts)
