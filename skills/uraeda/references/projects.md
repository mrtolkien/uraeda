# Projects

What happens only when a human asks: setting Uraeda up in a project, and starting, postponing, or
dropping a feature or a change.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md` and
`CONSTITUTION.md` into the project's `specs/` folder, and create its `decisions/` folder with an
empty `.gitkeep`. Never overwrite a file that exists, and do not copy the feature or decision
templates: they stay in this skill. With `ura`, `ura init` does it, and `ura install` installs or
updates this skill, for the user or in the repository. Agents pass its flags and `--no-input`.

When the human keeps notes, make the project's folder there, `projects/<repository>/` with its
`proposals/` and `research/`, as [Notes](notes.md#the-layout) says, and say in the project's agent
instructions where the notes are, so an agent without `ura` finds them.

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

## Starting a feature

Only when the human asks: "start the keyboard shortcuts proposal". The proposal is the one they
name, in their notes, or the text they give in the session. The default branch gets no commit: the
feature lives on its own branch until it merges.

1. **Name it**: today's date and a slug of two words at most, `YYYY-MM-DD-<slug>`, like
   `2026-10-06-recurring-tasks`. Propose a slug from the proposal's title, and take the human's when
   they give one. The date never changes, even if the feature is renamed. When a branch or a folder
   of that name exists, choose another slug.
2. **Make its worktree**: a branch of that name, from the default branch as it is on the remote, or
   locally without one, checked out in a worktree of its own. A session host that makes worktrees
   makes it, and runs the session there. Otherwise, from the main checkout:
   `git worktree add -b <name> .worktrees/<name> origin/<default>`, with `.worktrees/` kept out of
   `git status` through `.git/info/exclude`, never a tracked file. When `core.hooksPath` is a
   relative path, commit in the worktree with it made absolute from the main checkout, so the same
   hooks run. Set the worktree up as the project asks before running anything in it. Never switch
   the human's checkout to the branch.
3. **Copy the proposal** into `specs/<name>/proposal.md`, its words unchanged: the proposal is the
   human's words, never rewritten. Its images go into `specs/<name>/images/`, re-encoded as
   [the conventions](conventions.md#markdown) say, and its image links point at them. Its wikilinks
   to other notes become their text. A proposal is free form: never refuse one for a missing
   section, and add only the `discovery` field when it has none, `high`.
4. **Commit it alone**, as the branch's first commit: `chore(<slug>): proposal`, with the proposal's
   title as the body.
5. **Mark the note started**: set its `status` to `started` and its `branch` to the branch's name,
   in its frontmatter only, as [proposals and priorities](notes.md#proposals-and-priorities) says.
   With `ura`, `ura vault write`. Without notes, nothing.
6. **Run the next step**: [Discovery](discovery.md), round 01, in the same session, unless the
   human's settings cut it.

A started branch whose `proposal.md` is not committed, because the session that made it stopped,
resumes at step 4.

**Starting a change** is the same, under its own names: the folder
`specs/changes/YYYY-MM-DD-<slug>/`, the branch `change/YYYY-MM-DD-<slug>`, the worktree
`.worktrees/YYYY-MM-DD-<slug>/`, then the [change](change.md). The proposal may be a note of the
inbox: its text is the proposal, and the human moves or deletes the note. A change made a feature
moves in place: see [Upgrading](change.md#upgrading).

## Postponing or dropping a feature

Only when the human asks. Stop first when the worktree has uncommitted changes: they would be lost.

**Postpone**, or block: the feature leaves the workflow, and a proposal stays, in the human's notes,
written so the next start does not begin from nothing.

1. **Write its state as a proposal**: a new note of `projects/<repository>/proposals/`, named after
   the old one with `-postponed` added, or the text in your last message without notes. It keeps the
   proposal's `discovery` level, its title, a **What** and a **Why**, and the human's words wherever
   they still hold. What their answers, notes, and reviews settled becomes part of the request, said
   as they decided it, never as a question or an option. It ends with what is still open or
   unverified, and where the earlier work lives: the branch, its last commit before the closing one,
   and the paths of its rounds, spec, and rulings, read with `git show <commit>:<path>`. Its
   `status` is the one the human names, `later` when they name none.
2. **Mark the old note** `status: postponed`, in its frontmatter only.
3. **Close the branch**: remove its dated folder and commit, `chore(<slug>): close for postponing`.
   A branch without its folder is no longer a feature, so no step resumes it in place of the new
   proposal. Its previous commit keeps every file. The branch is never merged: its code and its
   edits to the decisions never reach the default branch.
4. **Remove the worktree**, never forced, and keep the branch. A session host's worktree is removed
   through the host. The worktree you are in stays: give the human `git worktree remove <path>`.

**Drop**: after the human confirms, remove its worktree as above, and keep its branch, so nothing is
lost: give the human `git branch -D <branch>` to delete it. Tell them the proposal's note is theirs
to delete. A merged feature is not dropped: it is done.

## After the merge

A merged feature's worktree and branch stay until the human, or their session host, removes them:
`git worktree remove <path>`, then `git branch -D <branch>` once every commit of the branch is on
the default branch, as [clean up after a merge](by-hand.md#clean-up-after-a-merge) checks. The
proposal's note in the human's notes is theirs: it says `started`, and the record in `specs/done/`
says the rest.
