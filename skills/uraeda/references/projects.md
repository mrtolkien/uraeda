# Projects

What happens only when a human asks: setting Uraeda up in a project, and starting, postponing, or
dropping a feature. And how a feature ends, once its work is done.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, and `PRIORITIES.md` into the project's `specs/` folder, and create its `drafts/`,
`backlog/`, `decisions/`, and `bugs/` folders, each with an empty `.gitkeep`, since git keeps no
empty folder. Never overwrite a file that exists. The constitution is the human's: help them write
it by asking about the project's goals and constraints, and propose principles with recommended
wording. Do not copy the feature, decision, or bug templates: they stay in this skill.

With `ura`, `ura init` does it, and writes nothing outside `specs/`. When it finds no Uraeda skill,
for the user or in the repository, it offers to install this skill for the user. `ura install`
installs or updates this skill, for the user in the home folder (`--user`) or in the repository's
top level (`--repo`), in `.agents/skills/uraeda/` (`--agents`), `.claude/skills/uraeda`
(`--claude`), or both, the second then a link to the first. It writes a `.ura-manifest` of the
files' hashes, so running it again updates the files nobody edited, and it never writes into a
folder it did not install, nor through a link. `ura install --update` updates every copy it
installed. Agents always pass these flags and `--no-input`: an agent's terminal can pass the
terminal check, yet no one presses its keys.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Draft**: a line of `PRIORITIES.md` becomes a draft in `specs/drafts/<slug>.md`, from the
  proposal template with the line as its title and as the first paragraph of What, and no
  placeholder text, and the line links to it. With `ura`, `ura draft <text>` does it, on the default
  branch, without committing, and opens the editor.
- **Start**: name the folder with today's date and a slug of two words at most,
  `YYYY-MM-DD-feature-slug`, like `2026-10-06-recurring-tasks`. Propose a slug from the feature's
  name and ask the human for theirs before starting. The date never changes, even if the feature is
  renamed. If a folder or branch with that name exists, choose another slug. With `ura`,
  `ura start <draft> --slug <slug>` runs these steps for a draft file or postponed folder, whatever
  it holds: the proposal is freeform. Without `--slug`, it takes the first two words of the draft's
  name that name something.
  1. On the default branch, move the feature's `PRIORITIES.md` entry to the end of **Now**, unless
     the human says otherwise, as a link to the future `proposal.md` from the repository root,
     `[Name](/specs/YYYY-MM-DD-feature-slug/proposal.md)`, and commit with
     `chore(<slug>): start <feature name>`. Entries match branches through that link.
     `PRIORITIES.md` lives on the default branch: feature branches only remove their own entry, in
     their last commit.
  2. Create the branch `YYYY-MM-DD-feature-slug` from there, checked out in its worktree,
     `.worktrees/YYYY-MM-DD-feature-slug/`, unless the human asks to switch their checkout to it. On
     it, create `specs/YYYY-MM-DD-feature-slug/`, and move the draft or backlog file into it as
     `proposal.md`, unchanged: the proposal is the human's words, never rewritten. When the entry is
     a folder, a feature postponed earlier, move all its files into it, unchanged. Commit with
     `chore(<slug>): proposal`. When the entry has no file, write `proposal.md` from the template
     with only what the human said, and do not commit it: the human writes it out, and commits it
     once it is ready. Until then, the feature waits at a gate on `proposal.md`, and no step runs.
  3. Then run the next step in the same session when you can: [Discovery](discovery.md), round 01,
     for a proposal alone, or the first matching row of
     [the table](../SKILL.md#finding-the-next-step) for a folder. A round left waiting for answers
     stays at its gate. When the human asks for fresh research, start a new round instead, following
     [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
- **Postpone or block**: on the feature's branch, move the whole folder to `specs/drafts/<slug>/` or
  `specs/backlog/<slug>/`, as the human prefers, without its date: the proposal, the discovery
  rounds, and the questions, answered or not, stay as they are. Delete the feature's `proposed`
  decisions, and the `## Proposed change` sections it added. In the same commit, move the
  `PRIORITIES.md` entry to the right section, with the reason when it is blocked, and link it to the
  folder's `proposal.md`. Commit with `chore(<slug>): postpone <feature name>`, merge the branch
  into the default branch, and delete it.
- **Drop**: delete the branch, and the `PRIORITIES.md` entry, after the human confirms.

## Finishing a feature

Once a feature's final review or a bug's fix is done, its folder is replaced by one record,
`specs/done/YYYY-MM-DD-<slug>.md`, in the last commit of its branch, before its pull request is
ready: the default branch keeps what the feature does and why, and git keeps the rest. Links into
the folder are rewritten to the record, whose questions keep their anchors. Records are frozen once
merged. See [Finish](finish.md).

After the merge, the branch and its worktree stay until the human runs `ura clean`, which removes
them unless that would lose work.
