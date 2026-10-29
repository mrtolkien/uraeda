# Inbox

Where the human, and agents, write down small things noticed about the software, and how those notes
are organized later.

## What the inbox is for

A misaligned icon, a confusing command, an idea: things worth keeping, noticed while doing something
else, and not proposals yet. The human writes them down in a few seconds and goes back to what they
were doing. Notes wait in `specs/INBOX.md`, grouped under categories the human names, until someone
decides what each becomes: a proposal, a line or a file, part of an existing proposal file, a
change, or nothing.

## Setting it up

The inbox is optional. A project without `INBOX.md` has no notes, and the first note creates it.
[Setting up a project](projects.md#setting-up-a-project) copies its template, `# Inbox` alone.

A project that kept its notes elsewhere, like a `## Scratchpad` section of `PRIORITIES.md`, moves
them into the inbox in one commit on the default branch, from the files as they are then:

1. **Move every note**: each bullet of the section, with the lines indented under it, goes to the
   end of the notes without a category in `INBOX.md`, as it is, in the same order. Notes are not
   fixed, merged, sorted, or given a category on the way: organizing them is the inbox's work,
   later.
2. **Remove the section** from `PRIORITIES.md`: its heading, its notes, and any other text under it,
   every other line kept as it is.
3. **Commit** `INBOX.md` and `PRIORITIES.md` alone, with `chore: move the scratchpad to the inbox`.

## The format

`specs/INBOX.md`, on the default branch:

```md
# Inbox

- We'll need a model selector for each step

## UI

- [run-ui] In failures the `x` is not centered in the circle
- [agent] [session-view] Opening a session with 2,000 messages takes 4 s
- [The spec page's headings are body-sized](notes/the-spec-pages-headings-are-body-sized/note.md)

## CLI

- Allow no selection in responses (after a warning)
```

- **Note**: an item at column 0, a line starting with `- `, `* `, or a number and `. ` like `1. `,
  with the lines indented under it; tools write `- `. Its text is the line after the marker and the
  marks. A note is a line or a file, like a proposal: a note with a note file is a markdown link to
  it, in `specs/notes/`, covering its whole text. A note whose link points anywhere else, like a
  proposal file or a web page, has no note file: its link is text.
- **Marks**: leading groups `[agent]`, then `[<slug>]`, each followed by one space. A slug is
  lowercase letters, digits, and `-`. Any other bracket, like `[!]`, is text.
- **Category**: a `## ` heading; its name is the heading's text, without closing `#`s: `## UI ##` is
  `UI`. Notes before the first `##` have no category. Other headings and text are kept and ignored.

The `[agent]` mark says an agent wrote the note. The slug is the folder of the feature or
[change](change.md) the note is about, without its date: `[run-ui]` for `specs/2026-10-14-run-ui/`
or `specs/changes/2026-10-14-run-ui/`. Lines inside fenced code are not notes, a fence indented
under a note is part of it, and a `###` heading does not end a category. A category's name appears
once: tools add to the first heading of a name, and `ura check` reports a repeated one. A category
left empty keeps its heading.

Tools edit the file line by line: every line they do not change keeps its bytes. By hand, do the
same.

## Capture

The human's notes are written on the default branch, from any checkout, like `PRIORITIES.md`: in the
checkout or worktree that has the default branch, see [Branches](conventions.md#branches). An
agent's notes are written in its own worktree, see [agents' notes](#agents-notes). Write one line
per note, at the end of its category, or after the last note without one. A new category goes at the
end of the file. When `INBOX.md` does not exist, create it as `# Inbox`, a blank line, and the note,
and add that title to a file without one.

- **By hand**: add the line, then commit `specs/INBOX.md` alone, with
  `chore: add "<note>" to the inbox`. When it has other uncommitted changes, write the note without
  committing: they are someone's work in progress.
- **With `ura`**:
  `ura note <text> [--category <name>] [--about <feature or change>] [--agent] [--no-commit]` writes
  the note on the default branch, or in this checkout with `--agent`, and commits `specs/INBOX.md`
  alone. When `INBOX.md` had other uncommitted changes, it writes without committing, and says
  "INBOX.md had uncommitted changes: the note is written but not committed." `--about` writes the
  slug of the target's folder; inside a feature's or a change's worktree, it defaults to that one.
  `--category` names the category, created when missing; `--agent` adds the `[agent]` mark;
  `--no-commit` leaves the file for you to commit. It refuses a blank note with "A note needs
  text.", and runs only in a repository with a `specs/` folder.
- **In the web UI**: the ＋ next to Inbox in the sidebar, from any page. From a feature's or a
  change's page, the note gets its slug. "Add" leaves it uncommitted, for the commit page's Commit.
  "Add as a file" saves a note with images as a file that holds them, linked from the inbox: pick,
  paste, or drop as many as it needs.
- **In the editor**: the plugin's "Add a note" action, which writes without committing.

### Images on a note

An image belongs beside the file that links it, and `INBOX.md` has no folder of its own: a note's
images live in its note file's folder, in `specs/notes/`, as
[the attachments decision](/specs/decisions/attachments.md) says. By hand, to add images to a note:

1. When the note has no note file, write one, `specs/notes/<slug>/note.md`. A note file is free
   form, from no template: the note's text is its `# ` title, and its sub-items follow. The note's
   line becomes a link to the file, with its marks kept and no sub-items left. When the slug is
   taken, it gets `-2`, `-3`, ...
2. Put each image in the note file folder's `images/`, and link it at the end of the file, each on a
   line of its own after a blank line: `![alt](images/name.webp)`. In a note file written from the
   proposal template, as older tools wrote them, the links go at the end of its What. A single-file
   note file, `<slug>.md`, becomes a folder first, `<slug>/note.md`, and the links to it follow.

The web UI does it from a note's page, with "Add images", or by dropping them on the page, and draws
the images under the note's text, and the first one on its row.

An image no file of its folder links is an orphan: a commit of the folder deletes it, and one left
in a folder nobody has committed stays on disk. `ura inbox clean` lists them with `--dry-run`, and
deletes them without it, in every folder of `specs/proposals/` and `specs/notes/`, leaving the
deletion uncommitted. By hand, delete the files of `images/` that no markdown file of the folder
links.

## Organizing by hand

The human decides what each note becomes. Each outcome moves the note out of `INBOX.md`, in the same
commit as what it became:

- **A proposal**: the note's lines become the last proposal of a `PRIORITIES.md` section, links kept
  and marks dropped. A note with a note file takes it along: the file, or its folder with its
  images, moves to `specs/proposals/` under a free name, its `note.md` becoming `proposal.md`, and
  the line links its new path. A proposal file needs a `## What`, so a free-form note file takes the
  proposal template's shape on the way: its `# ` title as the title and the first paragraph of What,
  the rest of its text after it, and no placeholder text. A note file with a `## What` moves as it
  is.
- **A new proposal file**: `specs/proposals/<slug>.md` from the proposal template, with the note as
  its title and the first paragraph of What, and no placeholder text, linked from the end of a
  section of `PRIORITIES.md`. When the slug is taken, it gets `-2`, `-3`, ... A note with a note
  file moves it there instead, as above.
- **A line of an existing proposal file**: the note's lines, marks dropped, at the end of the
  proposal file's `## What` section. A note with a note file goes into the proposal file's
  `## Notes` instead, added at the file's end when it has none: the note file's text at its end,
  under a `### <note title>` heading, its own headings nested below it and its images moved beside
  the proposal file (a single proposal file becomes its folder's `proposal.md`). The note file is
  deleted. A note with a note file can go into any proposal of `PRIORITIES.md`: a proposal without a
  file gets one first, `specs/proposals/<slug>.md` from the proposal template, named after the
  proposal's text, which is its title and the first paragraph of What, its sub-items after it, or
  `<slug>/proposal.md` when the note file has images. The proposal becomes a link to it, alone, and
  the note goes into its `## Notes`.
- **A change**, for a bug or a small change: the note becomes a new proposal file, as above, which
  the human then starts as a change, as [starting a change](change.md#starting-a-change) says. The
  note leaves the inbox in the proposal file's commit. Starting makes a branch, which only the human
  asks for: the inbox page has no action for it.
- **Nothing**: the note is deleted, with its note file and the images in it. A note file with
  uncommitted changes the note did not write stays, unlinked: tell the human. A note linking a
  proposal file loses its line only: the file stays.

A note can also have its text edited, its marks kept, or move, with the lines indented under it, to
another place in its category or to another category.

Commit `INBOX.md` with the files the notes went into, their note files' moves and removals included,
and nothing else. The message names the one change, with the note's text shortened like a
proposal's: `edit "<note>" in the inbox`, `remove "<note>" from the inbox`,
`move "<note>" within <Category> in the inbox`, `move "<note>" to <Category> in the inbox`, with
`No category` for none, `move "<note>" from the inbox to <Section>`, or
`move "<note>" from the inbox to the proposal <title>`, each with `chore:`. A note counts as moved
only when the proposal, or the proposal file's line, has its exact text: one edited on the way is a
removal and an addition. With more changes, `PRIORITIES.md`'s included, the subject names the first
one and ends with `, and <count> more`, and the body lists every change, one per line, the inbox's
first: `- Move from the inbox to Next: <note>`, `- Remove from the inbox: <note>`. See
[Commits](conventions.md#commits).

## The triage

When the inbox is large or messy, the human asks an agent to propose what each note becomes. The
agent writes its outcomes as questions in `specs/INBOX-TRIAGE.md`, the human answers them like a
round of questions, and an agent carries out the answers. Both runs happen in the default branch's
checkout, and need no feature. [The decisions check](decisions-check.md) works the same way on the
decisions.

### Proposing a triage

1. **Refuse a second triage.** When `specs/INBOX-TRIAGE.md` exists, stop and say: "An inbox triage
   already waits: answer or delete specs/INBOX-TRIAGE.md first."
2. **Read every note against the project**: the code it is about, `PRIORITIES.md`, the proposal
   files, and the open feature and change branches. A note may be done already, a duplicate, or part
   of a proposal.
3. **Write `specs/INBOX-TRIAGE.md`** from [the template](../assets/templates/specs/INBOX-TRIAGE.md),
   with `status: awaiting-human`, following [Writing for the human](writing.md) as a round of
   questions does, but for its free Context and its lack of settled points:
   - The `> [!IMPORTANT]` block, as in
     [Coming back to the human](../SKILL.md#coming-back-to-the-human): its first line gives the
     questions, the notes they cover, and the time, computed as
     [the time estimate](writing.md#the-time-estimate) says: "8 questions on 11 notes, about 15
     minutes".
   - **Context**: how many notes the inbox holds, how many the triage covers, and what you read.
     Cover every note; when they are too many for one sitting, cover whole categories, and say which
     wait for a later triage.
   - **One question per note, or per group of notes** that go to the same place. A question names
     its notes by their text, quoted, so the human, and the agent that applies it, find them without
     line numbers. Quote each note whole, word for word, however long: never cut it or end it with
     an ellipsis, since a cut note is not found and the human cannot read the rest. Its heading
     names its notes by their subject, in a few words, not by a quote. Its options, the recommended
     one first, are among these: a proposal in a section of `PRIORITIES.md`, a new proposal file, an
     existing proposal file named by its title, a change, deletion, or keeping it in the inbox. A
     new proposal file option names its title and the section that links it. A change option, for a
     bug or a small change, names its proposal file's title and the slug it would start with.
   - **Links** only to files on the default branch, such as proposal files. A started feature's or
     change's files live on its branch: name it by its title, or `ura check` reports the link.
   - **Notes:**, last, for the human. A triage has no points settled without the human: every
     outcome is theirs.
4. **Commit** `specs/INBOX-TRIAGE.md` alone, with `chore: propose an inbox triage`, and the block's
   first line as the body. Stop: the triage waits for the human.

The human answers it like any round: each `**Answer:**` filled, `status: answered`, and the file
committed alone with `chore: answer the inbox triage`. In the web UI, the inbox page's "Answer it"
opens it in the questions view, and Submit commits it. `ura answer` answers features' rounds only.

### Applying the answers

Once `INBOX-TRIAGE.md` is `answered`:

1. **Carry out each answer** on the notes it names, found by their text in `INBOX.md` as it is now,
   as [organizing by hand](#organizing-by-hand) does. A new proposal file for a group of notes takes
   the option's title, and the notes' lines, marks dropped, as its What. A note answered with a
   change becomes a new proposal file in the same way, linked from **Now**, first after its started
   proposals and their blank line, next to where starting puts it. A note kept in the inbox does not
   change. A note added after the triage was written stays in the inbox, untouched. A note the
   triage names that is no longer there is skipped.
2. **Commit once**: `INBOX.md`, `PRIORITIES.md`, the proposal files the notes went into, and the
   deletion of `INBOX-TRIAGE.md`, with `chore: apply the inbox triage`. The body lists every note
   the triage names, one per line, in the questions' order:
   `- Move from the inbox to <Section>: <note>`,
   `- Move from the inbox to the proposal <title>: <note>`, `- Remove from the inbox: <note>`,
   `- Start the change <slug>: <note>`, `- Keep in the inbox: <note>`, and
   `- Skip, no longer in the inbox: <note>`.
3. **Start each change** an answer asked for, from its proposal file, with the slug of its option,
   as **Start as a change** in [Projects](projects.md#starting-postponing-and-dropping-a-feature)
   says: `ura start <proposal> --slug <slug> --change`. The answer is the human asking for it, as
   [starting a change](change.md#starting-a-change) requires. Its proposal is the file, unchanged:
   the human's note, not what the question's context found. Then say to open `/f/<folder>` in the
   web UI, where the change's own session runs: this run does not make the change.

## Agents' notes

An agent's note is exceptional. The human reads every note and decides what it becomes, so each one
costs their attention. Most features and changes add none. A review's findings are graded first, as
[grade the findings](implementation.md#grade-the-findings) says: a critical or important one is
fixed or ruled on, never dropped. Anything else an agent finds while working on a feature or a
[change](change.md), like a slow page or a confusing message, goes one of three ways:

- **The work needs it**: a problem in the behaviour the branch builds, in the code it writes, or one
  the approved work cannot ship without. It is part of the work: fix it on the branch, with a test
  when it is behaviour, and name it in the pull request.
- **It passes the two tests below**: add a note.
- **Neither**: drop it. It goes nowhere: not in the inbox, not in `rulings.md`, not in the pull
  request.

A problem that was already there, in code the branch touches but does not need fixed, is not the
work's. A failure the project's validation shows is reported in the pull request, as the
[implementation](implementation.md#before-the-first-task) step says; anything else is a note or
nothing. The two tests:

1. **It is important**: users lose data, time, or trust, a security guard is missing, or every later
   change will pay for it. A name, a style preference, a function near a size limit, or a missing
   test of code the branch did not change is not. When in doubt, it is not important: drop it.
2. **It needs the human, because it clearly falls outside the feature or change**: fixing it would
   grow the scope they approved, and only they start new work, or it takes their choice, a product
   direction, a tradeoff, or a decision to change. An important problem outside the work is never
   fixed in passing, and never dropped.

A note is written:

- marked `[agent]`, then with the slug of the feature or change the note is about;
- under the category that fits, or a new one named like the others;
- with `ura note <text> --agent --about <slug> --category <name>`, or by hand, in its own worktree
  and branch, never in the default branch's checkout: the note is committed alone with
  `chore: add "<note>" to the inbox`, and reaches the default branch with the branch's merge.

Then the agent names the note in its step's report, and in the pull request when it opens one.
