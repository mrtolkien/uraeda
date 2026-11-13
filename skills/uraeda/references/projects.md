# Projects

What happens only when a human asks: setting Uraeda up in a project, and starting, postponing, or
dropping a feature or a change.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, `PRIORITIES.md`, and `INBOX.md` into the project's `specs/` folder, and create
its `proposals/`, `decisions/`, and `changes/` folders, each with an empty `.gitkeep`. Never
overwrite a file that exists, and do not copy the feature or decision templates: they stay in this
skill. With `ura`, `ura init` does it, and `ura install` installs or updates this skill, for the
user or in the repository. Agents pass its flags and `--no-input`.

The constitution is the human's: help them write it by asking about the project's goals and
constraints, and propose principles with recommended wording. Keep it to what they would refuse to
give up. A principle that names a measure, like "size never goes up", blocks work the first time a
feature needs the opposite: write the goal it protects instead.

Then propose, each committed once the human approves it:

- **A code-quality decision**, `specs/decisions/code-quality.md`, for the project's own linters:
  limits, the stack's shared lint config, and today's offenders marked in place, as
  [setting up checks](code-quality.md#setting-up-checks) describes. Once approved, configure the
  linters in a commit of their own.
- **A testing decision**, `specs/decisions/testing.md`, from
  [the template](../assets/templates/specs/decisions/testing.md): the project's stage, and what its
  tests cover at that stage, as [how many](code-quality.md#how-many) describes. Recommend `early`
  for a new project. The stage moves only when the human says so.
- **For a project with a UI, a preview decision**, `specs/decisions/preview.md`, from
  [the template](../assets/templates/specs/decisions/preview.md): where mockups live as stories, and
  the command that starts their preview, with `{port}`. A stack Storybook supports uses its own
  Storybook, on the Vite builder, with `uraeda-preview.js` and `uraeda-pick.js` copied from this
  skill's `assets/storybook/`. Any other stack gets a small mockups Storybook at the repository's
  root, or keeps its mockups as HTML pages, or uses the preview the project already has, like a
  component gallery. A preview whose stories read data says how in the decision: a tool that shows
  it may forward only read requests.
- **For a project with a UI, a guide**, `specs/ui/`, as [writing a guide](spec.md#writing-a-guide)
  says: free-form files that say how its views read, behave, and look, and who uses them. Start it
  with what the human says about the first mockups, and add each taste they state afterwards. It is
  the one place that stops the same comment from being made twice.

A project that lacks one of the three decisions is asked once, by the next round of questions,
whether to adopt it. A "no" becomes that decision, saying so, with a date in its **Revisit when**:
no round asks again before that date.

A project is set up once its constitution is written and its code-quality and testing decisions
exist, whatever their status.

## Starting, postponing, and dropping a feature

Do these only when a human asks. Each is one command with `ura`, and a few commits
[by hand](by-hand.md#start-postpone-or-drop-a-feature-or-a-change).

- **Expand**: a proposal line of `PRIORITIES.md` becomes a proposal file,
  `specs/proposals/<slug>.md`, which the human then writes. `ura expand <text>`.
- **Start**: the proposal file moves, its words unchanged, to `specs/YYYY-MM-DD-<slug>/proposal.md`
  on the default branch, with today's date and a slug of two words at most. Its line moves to the
  top of **Now**, and its branch is created in a worktree, `.worktrees/YYYY-MM-DD-<slug>/`. Propose
  a slug and ask the human for theirs before starting. `ura start <proposal> --slug <slug>`. Then
  run the next step in the same session: [Discovery](discovery.md), round 01.
- **Start as a change**: the same, under `specs/changes/YYYY-MM-DD-<slug>/` and the branch
  `change/YYYY-MM-DD-<slug>`. `ura start <proposal> --slug <slug> --change`. Then run the
  [change](change.md).
- **Start a change as a feature**: on the human's yes, a started change becomes a feature in place,
  as [upgrading](change.md#upgrading) says. `ura start <change> --feature`.
- **Postpone or block**: the feature leaves the workflow, and a proposal stays. Its current state is
  written as a new proposal file: the human's words wherever they still hold, what their answers and
  reviews settled as part of the request, what is still open, and where the earlier work lives in
  git. Its branch is closed, never merged.
- **Drop**: after the human confirms, its proposal and its folder leave the default branch. Its
  branch is kept, so nothing is lost.

The proposal is the human's words: no step ever rewrites it. A proposal is free form: never refuse
to start one for a missing section.

## Finishing a feature

Once a feature's final review or a change's review is done, its folder is replaced by one record, in
the last commit of its branch, before its pull request is ready: see [Finish](finish.md). After the
merge, the branch, its worktree, and its line in `PRIORITIES.md` stay until the human runs
`ura clean`.
