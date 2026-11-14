---
kind: feature
finished: 2026-11-14
pull-request: https://github.com/mrtolkien/uraeda/pull/125
supersedes:
  [
    2026-10-12-finish-feature,
    2026-10-15-add-scratchpad,
    2026-10-20-inbox-noise,
    2026-10-28-proposal-naming,
    2026-11-08-postpone-proposal,
    2026-11-08-triage,
  ]
---

# Record: Uraeda light, step 0: the workflow

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-14, finished on
> 2026-11-14, in [its pull request](https://github.com/mrtolkien/uraeda/pull/125). Its full files
> are in git: `git log -- specs/2026-11-14-uraeda-light-workflow/`.
>
> The four "Uraeda light" steps share one branch, `uraeda-light`, and one pull request. The three
> records beside this one are `2026-11-14-uraeda-light-serve`, `2026-11-14-uraeda-light-vault`, and
> `2026-11-14-uraeda-light-removal`.

## What and why

Uraeda becomes a workflow, a small `ura` binary, and other people's tools: Obsidian for the human's
notes, T3 Code for sessions and agents. The human wanted the workflow written down first, as the one
that stands once the three steps after it are done, because those steps are built from it: what
`ura` must do, and nothing more, is read from the skill. This step rewrote the skill, its templates,
its example, and the constitution. It changed no code.

The skill stays generic: the workflow is the product, and every tool is optional. It says what a
human and an agent do with files and git alone, and where a tool makes a step easier, never that a
step needs one. Obsidian, T3 Code, and `ura serve` are the human's own choices, given as examples
and defaults. There was no clarifications file, spec, or plan: the human worked in a chat session,
and each question was asked there, with a recommended answer.

## Behaviour

The proposal's points, as the skill now says them:

- **Ideas, the inbox, priorities, and proposals live in the human's notes, not in git.** A proposal
  is a note whose frontmatter is the board: `status` (`idea`, `later`, `next`, `now`), `rank`, and
  `discovery`. No file lists the priorities. See [Notes](../../skills/uraeda/references/notes.md).
- **Starting a feature is a new worktree whose first commit is the proposal.** The agent makes a
  branch and a worktree named after the folder `YYYY-MM-DD-<slug>`, copies the proposal unchanged
  with its images, and commits it alone, `chore(<slug>): proposal`. The default branch gets no
  commit before the merge. The note becomes `status: started` with its `branch`. A change starts the
  same way on `change/YYYY-MM-DD-<slug>`. See
  [Starting a feature](../../skills/uraeda/references/projects.md#starting-a-feature).
- **Agents make every commit.** The human answers a round or reviews a spec or a plan by editing
  files in the worktree, by hand or through a page, and commits nothing. The next agent step commits
  their files first, alone and unchanged, with the type of what they answer:
  `discovery(<slug>): answer round 01`, `spec(<slug>): approve`. The body says "Answered by the
  human, committed by the next step." See
  [The human's work is committed first](../../skills/uraeda/SKILL.md#the-humans-work-is-committed-first).
- **Discovery writes two things.** `discovery-NN.md` in git is short: a summary, the findings each
  question or settled point rests on with their sources, the map of the code, and what was not
  checked. The long report goes to the notes, in `projects/<repository>/research/`. What outlasts
  the feature goes into the wiki. See
  [Discovery](../../skills/uraeda/references/discovery.md#the-discovery-file).
- **A session host runs the agents, and each step has a pick.** A pick is an agent, a model, and an
  effort. The human sets one per step, and whether the step joins the previous step's session or
  starts a new one, outside the repository: with `ura`, in its configuration file. At a cut, the
  agent ends its turn with one message naming the next step and its pick. Without settings, the
  steps between two human gates share one session. See
  [Sessions and picks](../../skills/uraeda/SKILL.md#sessions-and-picks).
- **The constitution changed where the workflow needs it**, to 3.0.0, in
  [`CONSTITUTION.md`](../CONSTITUTION.md): II lets ideas, the inbox, priorities, proposals not yet
  started, and research notes live outside git, as long as nothing in git depends on them. III says
  an agent step ends with a commit, and the human's answers or review may wait uncommitted until the
  next agent step commits them first. V adds a notes app and a session host to the tools that stay
  optional, and has `specs/README.md` say what lives outside git.
- **Less paperwork.** `rulings.md` holds only what users will notice that the spec did not state, a
  departure from the approved files, or a test removed outside the spec's list. A review writes no
  findings file. Finish writes no `superseded-by`, and has no priorities line and no `ura clean`.
- **Postponing writes the state back as a proposal.** The agent writes a new note, named after the
  old one with `-postponed`, marks the old note `postponed`, removes the dated folder in a closing
  commit, and removes the worktree. The branch stays and is never merged. Dropping removes the
  worktree and keeps the branch.
- **A live round.** When the human asks for it, a session asks a round in chat, with no
  `clarifications-NN.md`. The spec is written in the same session and quotes the answers under
  **Assumptions**, and the record's round gives them one line each.

Rules a later feature keeps:

- **Tools are optional, everywhere in the skill.** A step names the tool that does it, after saying
  what to do by hand. No step needs `ura`, a notes app, or a session host. Without notes, an agent
  writes nothing there and says in its last message what it would have written.
- **Nothing in git depends on the notes.** A spec may link a note as further reading. A fact a
  question, the spec, or the plan relies on is read again at its source, and the file in git cites
  that source, never the wiki.
- **The default branch gets nothing but merges.** No step commits there. A feature's folder reaches
  it as a record.
- **`ura` never commits, branches, or makes a worktree.** It writes files, and reads git without
  running it or its hooks. See [the CLI](../../skills/uraeda/references/cli.md).
- **A human's file is never edited by the step that commits it.** Turning the block into a note, and
  every other change, comes in the step's own commit.
- **The human's words are never changed by an agent.** A proposal note takes an agent's edit in
  three cases, to its frontmatter only: starting, postponing, and finding the merged record.
- **A finding is fixed on the branch or dropped.** An important one left unfixed is a line of the
  pull request's "Look at". Nothing becomes a leftover list, and an agent's note is exceptional.

## Design

The skill is the specification of steps 1 to 3, so it describes the final `ura`, not a transition.
Each file was rewritten to what stands after the three steps, and the repository's own tool was
brought to it by those steps. The skill's picture of the notes is an Obsidian vault, given as an
example; the rules are about files.

- **The entry**: [`SKILL.md`](../../skills/uraeda/SKILL.md): the words (notes, session host, pick),
  the `specs/` tree without priorities, inbox, proposals, or findings, and the table that finds the
  next step. Its first rows commit the human's uncommitted work, then the proposal. The row "a
  `discovery-NN.md` without its `clarifications-NN.md` and no spec" is a round asked in a session
  and lost.
- **The notes**: [`notes.md`](../../skills/uraeda/references/notes.md), which replaces `inbox.md`.
  The vault is one for every repository: `inbox/`, `wiki/`, `projects/<repository>/` with
  `proposals/` and `research/`, and the human's own `inspiration/` and `docs/`. Each folder has one
  owner. `projects/<repository>/specs/` shows git's files for reading only.
- **The wiki** is `wiki/<kind>/`, with five kinds: `libraries/`, `apps/`, `standards/`, `topics/`,
  and `gotchas/`. A note has one home, and links carry the rest. A folder grows a level only when
  crowded, never deeper than `libraries/rust/`. A note's frontmatter has `description`, `checked`,
  `sources`, and `version` for a library or an app.
- **No index.** An index written by hand drifts. A listing comes from the notes' `description`:
  `ura vault ls wiki/libraries`, or the notes app's own view. `ura vault check` reports broken
  wikilinks and notes without a `description`.
- **Links**: notes in the vault use wikilinks, and files in git keep markdown links. A note's name
  is therefore unique in the whole vault.
- **The steps' files**: `discovery.md`, `projects.md`, `conventions.md`, `implementation.md`,
  `finish.md`, `change.md`, and `by-hand.md`, which shrank to what no step spells out: upgrading a
  change, where a moved link points, a pull request's state and comments, cleaning up, and a forge
  without drafts. `spec.md`, `plan.md`, and `writing.md` took small edits.
- **The CLI reference**: [`cli.md`](../../skills/uraeda/references/cli.md) lists `init`, `install`,
  `upgrade`, `check`, `next`, `status`, `answer`, `review`, `serve`, and `vault`. `start`, `clean`,
  `note`, `inbox`, `expand`, `lsp`, `add`, `extension`, `pair`, `key`, and `import-sessions` are
  gone from it.
- **The templates** in [`assets/templates/`](../../skills/uraeda/assets/templates/): the priorities,
  inbox, triage, and findings templates are gone. The discovery and rulings templates are short. The
  record loses `superseded-by`. The README says what lives outside git. New
  [`notes/`](../../skills/uraeda/assets/templates/notes/) templates hold a proposal, a wiki note,
  and a research report.
- **The example** in [`assets/example/`](../../skills/uraeda/assets/example/): a filled-in vault,
  [`notes/`](../../skills/uraeda/assets/example/notes/), with the todo app's proposals as a board,
  three inbox notes, the research report of recurring tasks, and five wiki notes. Its discovery file
  is short, its rulings keep only what users notice, and its record names the agent's note.

## Replaced behaviour

- **The inbox, the priorities, and the proposals as files of `specs/`**: `INBOX.md`,
  `INBOX-TRIAGE.md`, `PRIORITIES.md`, `specs/proposals/`, and `specs/notes/` are gone, with their
  templates and the example's copies. The notes replace them.
- **Starting a feature with a commit on the default branch**: a started feature has a branch and a
  worktree before any commit.
- **The human's commits on the priorities, the inbox, and the proposals**: the messages a human or a
  tool wrote for them are gone from the conventions and from by-hand. Agents commit the human's
  answers and reviews.
- **Findings files and the `review:` commit type**: `findings-NN.md` is gone from the build, the
  change, and the templates, and a review commits nothing.
- **`superseded-by`**: a finishing commit no longer edits older records. A reader finds what
  replaced one by searching `specs/done/` for its name.
- **Postponing by moving a folder to `specs/proposals/` on the default branch.**
- **The long discovery file**: its report half is in the notes.

No test guarded the skill's text, and none was removed. The checks of `ura check` and the table of
`ura next` still described the old workflow after this step: they knew nothing of committing the
human's work first, of the lost live round, of `done` as a proposal's status, and they allowed
findings files, inbox files, `superseded-by`, and the notes' folders. The removal step changed them.

## Gotchas

- `SKILL.md` has a length test in [`crates/cli/tests/skill.rs`](../../crates/cli/tests/skill.rs):
  20,000 characters. The rewrite went over it, and it stands at 19,996. A new rule goes in a
  reference file, never in the entry.
- A note's name is unique across the vault because wikilinks name notes, not paths. The example's
  topic note is `recurring-dates`, not `recurring-tasks`, since a proposal has the second name. A
  gotcha's name starts with its subject: `javascript-date-24-hours-is-not-a-day`.
- A proposal copied into a feature loses its notes' wikilinks, which become their text, and keeps
  only `discovery` of its frontmatter: `high` when it had none. The board's fields stay in the
  notes, so a feature's proposal never changes with the board.
- Uncommitted files tell two cases apart by who wrote them. A round or reviewed file with a human
  status is the human's, committed first. A new `spec.md` or `discovery-02.md` is a stopped step's,
  since no human edits a file before its step commits it: finish it from them, or delete them. A
  build's resume deletes code and `plan.md`'s boxes it does not trust, never the human's files.
- A round asked live exists only in the session until the spec is committed. The discovery file is
  committed alone, then the spec is written in the same session, whatever the human's settings cut:
  a cut there would lose the answers.
- A merged feature's note says `started` until an agent finds the record in `specs/done/` and sets
  it `done`. `ura status` lists those notes.
- A branch without its dated folder is no longer a feature, which is why postponing removes the
  folder in a closing commit: no step then resumes the branch in place of the new proposal.
- `pick` names an agent, a model, and an effort. A chosen answer or a choice between sections is
  never called a pick, so the word keeps one meaning in the skill.

## Questions

The questions were asked in the session, with no file: each is given with the human's answer.

### Round 01

#### Q1: Sessions: how are a feature's steps split across agent sessions?

**Answer:** The human's words: "It should be configurable like it was in 1.4. We could select where
the sessions ended, and which model they used." The options were gate to gate, a fresh session per
step, and one per feature. The skill follows the human: a setting per step says whether it joins the
previous session, as the [run options](2026-11-08-run-options.md) of version 1.4 did, and without
settings the steps between two gates share one.

#### Q2: Models: where is the model for each role or step configured?

**Answer:** `ura`'s configuration file, outside the repository, as recommended. A repository never
chooses what the human's runs spend.

#### Q3: Paperwork: slim rulings.md, findings files, and finish now, in step 0?

**Answer:** Slim all now, as recommended: rulings for what users notice or a removed test, no
findings files, and a finish without `superseded-by`.

#### Q4: Postpone, drop, and change-to-feature, now that nothing of a started feature is on the default branch?

**Answer:** Rewrite as proposal, not the recommended "branch stays": postponing writes the feature's
state back as a proposal in the notes and closes the branch. Dropping keeps the branch.

### Round 02

#### Q1: Wiki: how is the vault's wiki laid out, and what must a note hold?

**Answer:** The human's words: "I want more discussion on this subject. A clear discussion on the
shape of the folder. Let's have a back and forth chat in this session. Use mockups/tables." Round 03
is that discussion.

#### Q2: specs/README.md, once the inbox, priorities and proposals leave git: what does it say?

**Answer:** Layout and one paragraph, as recommended: what stays in git, the statuses, and that the
rest lives outside git. It names no app and links the skill.

#### Q3: Agents' notes (rare: something important found outside the feature): where do they go now?

**Answer:** The human's words: "The ura CLI should give access to the vault with some basic CRUD
features". An agent's note is one file in the vault's `inbox/`, written with `ura vault write`, and
named in the pull request. Without `ura`, it is not written.

#### Q4: Live sessions (like this one): may an agent ask a round's questions in chat instead of a clarifications file?

**Answer:** The human's words: "Specs are what really matters". The agent read it as: a round may be
asked in chat, with no file, when the human asks, and the spec quotes the answers. It said so and
asked to be corrected, and the human did not correct it.

### Round 03

The wiki's shape, discussed in chat. The agent offered five points, then researched agent wikis.

#### Q1: Shared `wiki/` or one per project?

**Answer:** Shared, at the vault's root. The human's words: "I feel like the wiki should be at the
root, with some pre-made folders like /libraries, /apps, /gotchas (which could link to libraries)".
They asked whether fixed folders were early optimization, and said "imo 2 to 3 levels of depth is
usually the right abstraction". The research found that a small fixed taxonomy helps, and that a
second level appears only when a folder is crowded.

#### Q2: Ideas vs proposals

**Answer:** One folder of proposals, whose `status` runs from `idea` to `now`, as the agent
proposed. The human raised no objection.

#### Q3: One shared inbox

**Answer:** One inbox with one note per capture, as proposed. The human raised no objection.

#### Q4: Links in the vault: markdown or wikilinks?

**Answer:** Wikilinks, against the agent's recommendation. The human's words: "I'd like to have wiki
links instead of markdown links it'll be easier for me when I edit the files".

#### Q5: `index.md` in the wiki

**Answer:** None. The human's words: "stuff like index.md would be better served by a small Obsidian
plugin/ura command. I don't want unnecessary upkeep, it leads to drift."

#### Q6: Is the list of five folders right?

**Answer:** Yes: `libraries`, `apps`, `standards`, `topics`, and `gotchas`. "Otherwise it looks good
to me." A `sources/` folder of page captures was left out, since the address is enough.

#### Q7: Gotchas as notes of their own, rather than a section of the library's note

**Answer:** Yes, each in `gotchas/`, linking what it is about, which links it back.

#### Q8: Research per project, or in the wiki

**Answer:** Per project, in `projects/<repository>/research/`: a report is about one feature of one
repository.

### The approval

The agent showed the shape before writing it: the skill file by file, the templates, the example,
and the constitution's new wording. The human answered "Approved".

## Changes after approval

- A round asked live is written into the spec in the same session, and the record quotes it. The
  outline had no rule for a session that stops before the spec.
- A build's resume never deletes the human's files, and an agent's uncommitted files are a stopped
  step's.
- Every step falls under one of the settings' picks: the comments, the catch-up, and the push share
  one, and the final review and the finish share another. A step with no pick runs on the session's
  own.
- `ura serve` finds repositories from its configuration.
- The notes show a repository's workflow files for reading, and a merged proposal's note becomes
  `done`.
- An agent edits a proposal note in three cases, not two: starting, postponing, and finding the
  merged record.
- A change's rulings follow the build's rule. The example's record names its agent's note.

An independent review of the whole rewrite found eleven problems, and ten were fixed. The eleventh,
that the constitution's templates say each amendment is a commit, was left: it does not say who
makes the commit.

## Follow-ups

- `ura check` accepts a `supersedes` that the older record does not name back: a record is frozen
  once merged. An older record's own `superseded-by` is still checked against the newer one. See
  [`values.rs`](../../crates/core/src/check/values.rs).
