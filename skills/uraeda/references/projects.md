# Projects

What happens only when a human asks: setting Uraeda up in a project, and starting, postponing, or
dropping a feature or a change. And how a feature ends, once its work is done.

## Setting up a project

When asked to set up Uraeda in a project, copy `assets/templates/specs/README.md`,
`CONSTITUTION.md`, `PRIORITIES.md`, and `INBOX.md` into the project's `specs/` folder, and create
its `drafts/`, `backlog/`, `decisions/`, and `changes/` folders, each with an empty `.gitkeep`,
since git keeps no empty folder. Never overwrite a file that exists. The constitution is the
human's: help them write it by asking about the project's goals and constraints, and propose
principles with recommended wording. Do not copy the feature or decision templates: they stay in
this skill.

Once the constitution is written, propose a code-quality decision,
`specs/decisions/code-quality.md`, for the project's own linters: limits, the stack's shared lint
config if it has one, and today's offenders marked in place, as
[setting up checks](code-quality.md#setting-up-checks) describes. It stays `proposed` until the
human approves it; then configure the linters and mark the offenders, in a commit of their own.

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
updates every copy it installed. Agents always pass these flags and `--no-input`: an agent's
terminal can pass the terminal check, yet no one presses its keys.

## Starting, postponing, and dropping a feature

Do these only when a human asks.

- **Draft**: a line of `PRIORITIES.md` becomes a draft in `specs/drafts/<slug>.md`, from the
  proposal template with the line as its title and as the first paragraph of What, followed by its
  children, which leave the line, and no placeholder text, and the line links to it alone. The
  children's relative links are rewritten to point at the same files from the draft's folder. With
  `ura`, `ura draft <text>` does it, on the default branch, without committing, and opens the
  editor.
- **Start**: name the folder with today's date and a slug of two words at most,
  `YYYY-MM-DD-feature-slug`, like `2026-10-06-recurring-tasks`. Propose a slug from the feature's
  name and ask the human for theirs before starting. The date never changes, even if the feature is
  renamed. If a folder or branch with that name exists, choose another slug. With `ura`,
  `ura start <draft> --slug <slug>` runs these steps for a draft file or postponed folder, whatever
  it holds: the proposal is freeform. Without `--slug`, it takes the first two words of the draft's
  name that name something.
  1. On the default branch, move the feature's `PRIORITIES.md` entry to the top of **Now**, after
     the other started entries, then a blank line, unless the human says otherwise, as a link to the
     future `proposal.md` from the repository root,
     `[Name](/specs/YYYY-MM-DD-feature-slug/proposal.md)`, and commit with
     `chore(<slug>): start <feature name>`. Entries match branches through that link. Started
     entries are those linking a dated folder's `proposal.md`, a feature's or a change's. Entries
     started lower in **Now** stay where they are, and no blank line is left at the end of **Now**.
     `PRIORITIES.md` lives on the default branch: feature branches only remove their own entry, in
     their last commit.
  2. Create the branch `YYYY-MM-DD-feature-slug` from there, checked out in its worktree,
     `.worktrees/YYYY-MM-DD-feature-slug/`, unless the human asks to switch their checkout to it. On
     it, create `specs/YYYY-MM-DD-feature-slug/`, and move the draft or backlog file into it as
     `proposal.md`, unchanged: the proposal is the human's words, never rewritten. When the entry is
     a folder, a feature postponed earlier or a draft with images, move all its files into it,
     unchanged. Commit with `chore(<slug>): proposal`. When the entry has no file, write
     `proposal.md` from the template with only what the human said, and do not commit it: the human
     writes it out, and commits it once it is ready. Until then, the feature waits at a gate on
     `proposal.md`, and no step runs.
  3. Then run the next step in the same session when you can: [Discovery](discovery.md), round 01,
     for a proposal alone, or the first matching row of
     [the table](../SKILL.md#finding-the-next-step) for a folder. A round left waiting for answers
     stays at its gate. When the human asks for fresh research, start a new round instead, following
     [going back to the human](../SKILL.md#going-back-to-the-human-with-new-questions).
- **Start as a change**: a bug fix or a small change starts as a [change](change.md), with the same
  steps under its own names: the folder `specs/changes/YYYY-MM-DD-<slug>/`, the branch
  `change/YYYY-MM-DD-<slug>`, and the worktree `.worktrees/YYYY-MM-DD-<slug>/`. In the web UI, "New
  change" starts one from a typed request, with no draft. With `ura`,
  `ura start <draft> --slug <slug> --change` starts a draft as a change, and refuses a postponed
  folder holding files a change's folder has no place for, like a feature's `spec.md`: start that
  one as a feature. By hand, the steps above, with the entry linked to
  `/specs/changes/YYYY-MM-DD-<slug>/proposal.md`. Then run the [change](change.md) step.
- **Postpone or block**: on the feature's branch, move the whole folder to `specs/drafts/<slug>/` or
  `specs/backlog/<slug>/`, as the human prefers, without its date: the proposal, the discovery
  rounds, and the questions, answered or not, stay as they are. Delete the feature's `proposed`
  decisions, and the `## Proposed change` sections it added. In the same commit, move the
  `PRIORITIES.md` entry to the right section, with the reason when it is blocked, and link it to the
  folder's `proposal.md`. Commit with `chore(<slug>): postpone <feature name>`, merge the branch
  into the default branch, and delete it.
- **Drop**: delete the branch, and the `PRIORITIES.md` entry, after the human confirms.

## Finishing a feature

Once a feature's final review or a change's review is done, its folder is replaced by one record,
`specs/done/YYYY-MM-DD-<slug>.md`, in the last commit of its branch, before its pull request is
ready: the default branch keeps what the feature does and why, and git keeps the rest. Links into
the folder are rewritten to the record, whose questions keep their anchors. Records are frozen once
merged. See [Finish](finish.md).

After the merge, the branch and its worktree stay until the human runs `ura clean`, which removes
them unless that would lose work.
