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

## R3: The preview's requirements stay in the skill, as the preview's

- **Decision**: setting up a project's preview keeps its requirements, Storybook's Vite builder, the
  two files of `assets/storybook/`, and data read by GET, now said of the preview, not of Uraeda.
  The Storybook assets and the example's preview decision are unchanged.
- **Rationale**: an agent setting up a project must meet them, in any harness, and the preview
  decision is a workflow file of the project.
- **Where**: [`projects.md`](/skills/uraeda/references/projects.md)

## R4: A test keeps the web UI out of the skill

- **Decision**: `the_skill_never_describes_the_web_ui`, in [`skill.rs`](/crates/cli/tests/skill.rs),
  fails when `SKILL.md`, a reference, or a template names the web UI: "web UI", "uraeda-offer", "in
  Uraeda", "Uraeda shows", or "Uraeda's helper". It caught a line of `decisions-check.md` the first
  pass missed.
- **Rationale**: the mix grew one line at a time, with each feature of the web UI; a review would
  miss the next one as easily.
- **If wrong**: a phrase the list lacks slips through; add it to the list.
- **Where**: [`skill.rs`](/crates/cli/tests/skill.rs)
