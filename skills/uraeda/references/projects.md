# Projects

What happens only when a human asks: setting Uraeda up in a project, and starting, postponing, or
dropping a feature or a change. And how a feature ends, once its work is done.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, `PRIORITIES.md`, and `INBOX.md` into the project's `specs/` folder, and create
its `proposals/`, `decisions/`, and `changes/` folders, each with an empty `.gitkeep`, since git
keeps no empty folder. `specs/notes/` comes with the first note file. Never overwrite a file that
exists. The constitution is the human's: help them write it by asking about the project's goals and
constraints, and propose principles with recommended wording. Do not copy the feature or decision
templates: they stay in this skill.

Once the constitution is written, propose a code-quality decision,
`specs/decisions/code-quality.md`, for the project's own linters: limits, the stack's shared lint
config if it has one, and today's offenders marked in place, as
[setting up checks](code-quality.md#setting-up-checks) describes. It stays `proposed` until the
human approves it; then configure the linters and mark the offenders, in a commit of their own.

Then propose a testing decision, `specs/decisions/testing.md`, from
[the template](../assets/templates/specs/decisions/testing.md): the project's stage, and what its
tests cover at that stage, as [how many](code-quality.md#how-many) describes. Recommend `early` for
a new project. The stage is the human's: it stays `proposed` until they approve it, and moves only
when they say so.

For a project with a UI, propose next a preview decision, `specs/decisions/preview.md`, from
[the template](../assets/templates/specs/decisions/preview.md): the Storybook in which mockups are
stories, which Uraeda runs and shows live. Its `preview-folder` is the folder Storybook runs in, and
its `preview-command` starts it with `{port}` and `--host 127.0.0.1`, as
`npx storybook dev --ci --no-open --exact-port --host 127.0.0.1 --port {port}`.

- **A stack Storybook supports** uses its own Storybook, in the folder that holds the UI, on
  Storybook's Vite builder: Uraeda's helper stops a webpack Storybook. Its `.storybook/main.ts` is
  wrapped by `uraeda-preview.js`, and its preview loads `uraeda-pick.js`, both copied from this
  skill's `assets/storybook/`. Its packages are pinned to exact versions, and its telemetry is off.
- **Any other stack**, like Rails or Django, gets a mockups Storybook in `storybook/` at the
  repository's root, in React with Astryx, with the same two files, reading
  `specs/*/mockups/*.stories.tsx` and `specs/changes/*/mockups/*.stories.tsx`. Its stories are
  mockups only, and leave with the feature's or the change's folder when it finishes.
- **Data**: Uraeda forwards only Storybook's GET and HEAD requests and WebSocket upgrades, in
  sandboxed frames. A story that reads data with POSTs needs a Storybook-only middleware turning
  GETs back into POSTs, and event streams opened without credentials: say so in the decision.

The decision stays `proposed` until the human approves it; then set Storybook up, in a commit of its
own. A "no" is recorded as [Discovery](discovery.md#what-to-ask-and-what-to-settle) describes.

With `ura`, `ura init` does it, and writes nothing outside `specs/`. It prints `created` or `kept`
for each template it copies: run again, it only adds what is missing, like `INBOX.md` in a project
set up before it. When it finds no Uraeda skill, for the user or in the repository, it offers to
install this skill for the user. `ura install` installs or updates this skill, for the user in the
home folder (`--user`) or in the repository's top level (`--repo`), in `.agents/skills/uraeda/`
(`--agents`), `.claude/skills/uraeda` (`--claude`), or both, the second then a link to the first. It
writes a `.ura-manifest` of the files' hashes, so running it again updates the files nobody edited,
and it never writes into a folder it did not install, nor through a link. `ura install --update`
updates every copy it installed. `--completions` sets up Tab completion of `ura` in the user's
shell: in fish, it writes `ura.fish` in fish's completions folder, and in zsh, it names the line to
add to `~/.zshrc`; alone, it leaves the skill as it is. In a terminal, `ura install` offers it.
Agents always pass these flags and `--no-input`: an agent's terminal can pass the terminal check,
yet no one presses its keys.

### Moving drafts and the backlog to the proposals

A project set up before proposal files kept them in `specs/drafts/` and `specs/backlog/`, which
tools no longer read: `ura check` reports each of the two that holds files. Move them in one commit
on the default branch, from the files as they are then:

1. **Move every file and folder** of `specs/drafts/` and `specs/backlog/` into `specs/proposals/`,
   unchanged, with `git mv`. A name already taken gets `-2`, then `-3`, ...
2. **Move the note files**: a draft that a note of `INBOX.md` links, and no proposal of
   `PRIORITIES.md` does, goes to `specs/notes/` instead, unchanged. In a folder, its `proposal.md`
   becomes `note.md`.
3. **Link the backlog under Later**: each former backlog file that no proposal links gets a proposal
   at the end of **Later**, a link to it with its title as the text.
4. **Rewrite the links** to the old paths, in `PRIORITIES.md`, `INBOX.md`, and every other workflow
   file, the moved ones included. In the records of `specs/done/`, only those links change.
5. **Remove the old folders**, empty now but for their `.gitkeep`. When `specs/proposals/` holds no
   file, give it an empty `.gitkeep`.
6. **Commit** the moves and the files whose links changed, alone, with
   `chore: move the drafts and the backlog to the proposals`.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Expand**: a proposal line of `PRIORITIES.md` becomes a proposal file,
  `specs/proposals/<slug>.md` or the next free name with `-2`, `-3`, ..., from the proposal template
  with the line as its title and as the first paragraph of What, followed by its children, which
  leave the line, and no placeholder text, and the line links to it alone. The children's relative
  links are rewritten to point at the same files from the proposal file's folder. With `ura`,
  `ura expand <text>` does it, on the default branch, without committing, and opens the editor.
- **Start**: name the folder with today's date and a slug of two words at most,
  `YYYY-MM-DD-feature-slug`, like `2026-10-06-recurring-tasks`. Propose a slug from the feature's
  name and ask the human for theirs before starting. The date never changes, even if the feature is
  renamed. If a folder or branch with that name exists, choose another slug. With `ura`,
  `ura start <proposal> --slug <slug>` runs these steps for a proposal file or folder of
  `specs/proposals/`, or its name, whatever it holds: the proposal is freeform. Without `--slug`, it
  takes the first two words of the proposal file's name that name something.
  1. On the default branch, create `specs/YYYY-MM-DD-feature-slug/`, and move the proposal file into
     it as `proposal.md`, unchanged: the proposal is the human's words, never rewritten. When the
     proposal is a folder, a feature postponed earlier or a proposal with images, move all its files
     into it, unchanged. A proposal with no file is expanded first, as **Expand** says: the human
     writes its file, and asks for the start once it is ready.
  2. In the same commit, move the feature's proposal in `PRIORITIES.md` to the top of **Now**, after
     the other started proposals, then a blank line, unless the human says otherwise, as a link to
     the `proposal.md` from the repository root,
     `[Name](/specs/YYYY-MM-DD-feature-slug/proposal.md)`, and commit with
     `chore(<slug>): start <feature name>`. The link resolves on the default branch, which holds the
     proposal from the start. Proposals match branches through that link. Started proposals are
     those linking a dated folder's `proposal.md`, a feature's or a change's. Proposals started
     lower in **Now** stay where they are, and no blank line is left at the end of **Now**.
     `PRIORITIES.md` lives on the default branch: feature branches only remove their own proposal,
     in their last commit. While the branch is there, the folder is the branch's: the default
     branch's copy is read as merged only once the branch is gone.
  3. Create the branch `YYYY-MM-DD-feature-slug` from there, checked out in its worktree,
     `.worktrees/YYYY-MM-DD-feature-slug/`, unless the human asks to switch their checkout to it.
     Every later step writes on the branch.
  4. Then run the next step in the same session when you can: [Discovery](discovery.md), round 01,
     for a proposal alone, or the first matching row of
     [the table](../SKILL.md#finding-the-next-step) for a folder. A round left waiting for answers
     stays at its gate. When the human asks for fresh research, start a new round instead, following
     [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
- **Start as a change**: a bug fix or a small change starts as a [change](change.md), with the same
  steps under its own names: the folder `specs/changes/YYYY-MM-DD-<slug>/`, the branch
  `change/YYYY-MM-DD-<slug>`, and the worktree `.worktrees/YYYY-MM-DD-<slug>/`. In the web UI,
  Change on the New page starts one from a typed request, an inbox note, or a proposal line, with no
  proposal file: a note's text is its request, and the note leaves `INBOX.md` in a commit of its
  own. A session's offer starts one too: see [Change](change.md#starting-a-change). With `ura`,
  `ura start <proposal> --slug <slug> --change` starts a proposal file as a change, and refuses a
  postponed folder holding files a change's folder has no place for, like a feature's `spec.md`:
  start that one as a feature. By hand, the steps above, with the proposal linked to
  `/specs/changes/YYYY-MM-DD-<slug>/proposal.md`. Then run the [change](change.md) step.
- **Start a change as a feature**: on the human's yes, a started change becomes a feature in place.
  It keeps its code, its worktree, and its sessions. With `ura`, `ura start <change> --feature`. By
  hand, as [Upgrading](change.md#upgrading) says.
- **Postpone or block**: on the feature's branch, move the whole folder to
  `specs/proposals/<slug>/`, without its date: the proposal, the discovery rounds, and the
  questions, answered or not, stay as they are. Revert the branch's edits to the decisions: delete
  the ones it created. Restore the ones it changed or removed to their text at the merge base with
  the default branch. In the same commit, move the feature's proposal in `PRIORITIES.md` to the
  section the human names, **Later** for one not scheduled, after what it needs when it is blocked,
  and link it to the folder's `proposal.md`. Commit with `chore(<slug>): postpone <feature name>`,
  merge the branch into the default branch, and delete it.
- **Drop**: after the human confirms, on the default branch, remove the feature's or the change's
  proposal from `PRIORITIES.md`, and its dated folder, which the start put there, so the default
  branch keeps no folder of a dropped feature or change: it would read as merged once its branch is
  gone. Stop first when that folder has uncommitted changes, since they would be lost. Commit both
  alone, `chore(<slug>): drop <name>`, only when `PRIORITIES.md` had no other changes: otherwise the
  removals stay uncommitted, beside the human's edits. Remove its worktree, never forced. It stays
  when it has uncommitted changes, is locked, is the one you are in, or is outside `.worktrees/`:
  then say where it stays. Keep the branch, so nothing is lost, and give the human
  `git branch -D <branch>` to delete it. In the web UI, "Drop the change…" or "Drop the feature…" in
  a session's actions does it. A merged feature is not dropped: `ura clean` removes it.

## Finishing a feature

Once a feature's final review or a change's review is done, its folder is replaced by one record,
`specs/done/YYYY-MM-DD-<slug>.md`, in the last commit of its branch, before its pull request is
ready: the default branch keeps what the feature does and why, and git keeps the rest. Links into
the folder are rewritten to the record, whose questions keep their anchors. Records are frozen once
merged, but for a broken link and the link to a newer record. See [Finish](finish.md).

After the merge, the branch and its worktree stay until the human runs `ura clean`, which removes
them unless that would lose work.
