# Inbox

Where the human, and agents, write down small things noticed about the software, and how those notes
are organized later.

## What the inbox is for

A misaligned icon, a confusing command, an idea: things worth keeping, noticed while doing something
else, and not priorities yet. The human writes them down in a few seconds and goes back to what they
were doing. Notes wait in `specs/INBOX.md`, grouped under categories the human names, until someone
decides what each becomes: a priority, a draft, part of an existing draft, a change, or nothing.

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
- [The spec page's headings are body-sized](drafts/the-spec-pages-headings-are-body-sized/proposal.md)

## CLI

- Allow no selection in responses (after a warning)
```

- **Note**: an item at column 0, a line starting with `- `, `* `, or a number and `. ` like `1. `,
  with the lines indented under it; tools write `- `. Its text is the line after the marker and the
  marks. A note linking a draft is a markdown link covering its whole text.
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

Notes are written on the default branch, from any checkout, like `PRIORITIES.md`: in the checkout or
worktree that has the default branch, see [Branches](conventions.md#branches). Write one line per
note, at the end of its category, or after the last note without one. A new category goes at the end
of the file. When `INBOX.md` does not exist, create it as `# Inbox`, a blank line, and the note, and
add that title to a file without one.

- **By hand**: add the line, then commit `specs/INBOX.md` alone, with
  `chore: add "<note>" to the inbox`. When it has other uncommitted changes, write the note without
  committing: they are someone's work in progress.
- **With `ura`**:
  `ura note <text> [--category <name>] [--about <feature or change>] [--agent] [--no-commit]` writes
  the note on the default branch, and commits `specs/INBOX.md` alone. When `INBOX.md` had other
  uncommitted changes, it writes without committing, and says "INBOX.md had uncommitted changes: the
  note is written but not committed." `--about` writes the slug of the target's folder; inside a
  feature's or a change's worktree, it defaults to that one. `--category` names the category,
  created when missing; `--agent` adds the `[agent]` mark; `--no-commit` leaves the file for you to
  commit. It refuses a blank note with "A note needs text.", and runs only in a repository with a
  `specs/` folder.
- **In the web UI**: the ＋ next to Inbox in the sidebar, from any page. From a feature's or a
  change's page, the note gets its slug. "Add and commit" commits the note alone, with
  `chore: add "<note>" to the inbox`, unless `INBOX.md` had other changes; its Undo commits the
  removal, `chore: remove "<note>" from the inbox`. "Add" leaves it for the commit bar's Commit. A
  note with an image becomes a draft that holds it, and the note links to the draft.
- **In the editor**: the plugin's "Add a note" action, which writes without committing.

## Organizing by hand

The human decides what each note becomes. Each outcome moves the note out of `INBOX.md`, in the same
commit as what it became:

- **A priority**: the note's lines become the last entry of a `PRIORITIES.md` section, links kept
  and marks dropped.
- **A new draft**: `specs/drafts/<slug>.md` from the proposal template, with the note as its title
  and the first paragraph of What, and no placeholder text, linked from the end of a priorities
  section. When the slug is taken, it gets `-2`, `-3`, ...
- **A line of an existing draft**: the note's lines, marks dropped, at the end of the draft's
  `## What` section.
- **A change**, for a bug or a small change: the note becomes a new draft, as above, which the human
  then starts as a change, as [starting a change](change.md#starting-a-change) says. The note leaves
  the inbox in the draft's commit. Starting makes a branch, which only the human asks for: the inbox
  page has no action for it.
- **Nothing**: the note is deleted. A note linking a draft loses its line only: the draft stays.

A note can also have its text edited, its marks kept, or move, with the lines indented under it, to
another place in its category or to another category.

Commit `INBOX.md` with the files the notes went into, and nothing else. The message names the one
change, with the note's text shortened like a priorities entry: `edit "<note>" in the inbox`,
`remove "<note>" from the inbox`, `move "<note>" within <Category> in the inbox`,
`move "<note>" to <Category> in the inbox`, with `No category` for none,
`move "<note>" from the inbox to <Section>`, or `move "<note>" from the inbox to the draft <title>`,
each with `chore:`. A note counts as moved only when the entry or the draft's line has its exact
text: one edited on the way is a removal and an addition. With more changes, `PRIORITIES.md`'s
included, the subject names the first one and ends with `, and <count> more`, and the body lists
every change, one per line, the inbox's first: `- Move from the inbox to Next: <note>`,
`- Remove from the inbox: <note>`. See [Commits](conventions.md#commits).

## The triage

When the inbox is large or messy, the human asks an agent to propose what each note becomes. The
agent writes the proposal as questions in `specs/INBOX-TRIAGE.md`, the human answers them like a
round of questions, and an agent carries out the answers. Both runs happen in the default branch's
checkout, and need no feature.

### Proposing a triage

1. **Refuse a second triage.** When `specs/INBOX-TRIAGE.md` exists, stop and say: "An inbox triage
   already waits: answer or delete specs/INBOX-TRIAGE.md first."
2. **Read every note against the project**: the code it is about, `PRIORITIES.md`, the drafts and
   the backlog, and the open feature and change branches. A note may be done already, a duplicate,
   or part of a draft.
3. **Write `specs/INBOX-TRIAGE.md`** from [the template](../assets/templates/specs/INBOX-TRIAGE.md),
   with `status: awaiting-human`:
   - The `> [!IMPORTANT]` block, as in
     [Coming back to the human](../SKILL.md#coming-back-to-the-human): its first line gives the
     questions, the notes they cover, and the time, about two minutes a question: "8 questions on 11
     notes, about 16 minutes".
   - **Context**: how many notes the inbox holds, how many the triage covers, and what you read.
     Cover every note; when they are too many for one sitting, cover whole categories, and say which
     wait for a later triage.
   - **One question per note, or per group of notes** that go to the same place. A question names
     its notes by their text, quoted, so the human, and the agent that applies it, find them without
     line numbers. Its options, the recommended one first, are among these: a priorities section, a
     new draft, an existing draft named by its title, a change, deletion, or keeping it in the
     inbox. A new draft option names the draft's title and the priorities section that links it. A
     change option, for a bug or a small change, names its draft's title and the slug it would start
     with.
   - **Links** only to files on the default branch, such as drafts. A started feature's or change's
     files live on its branch: name it by its title, or `ura check` reports the link.
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
   as [organizing by hand](#organizing-by-hand) does. A new draft for a group of notes takes the
   option's title, and the notes' lines, marks dropped, as its What. A note answered with a change
   becomes a new draft in the same way, linked from **Now**, first after its started entries and
   their blank line, next to where starting puts it. A note kept in the inbox does not change. A
   note added after the triage was written stays in the inbox, untouched. A note the triage names
   that is no longer there is skipped.
2. **Commit once**: `INBOX.md`, `PRIORITIES.md`, the drafts the notes went into, and the deletion of
   `INBOX-TRIAGE.md`, with `chore: apply the inbox triage`. The body lists every note the triage
   names, one per line, in the questions' order: `- Move from the inbox to <Section>: <note>`,
   `- Move from the inbox to the draft <title>: <note>`, `- Remove from the inbox: <note>`,
   `- Start the change <slug>: <note>`, `- Keep in the inbox: <note>`, and
   `- Skip, no longer in the inbox: <note>`.
3. **Start each change** an answer asked for, from its draft, with the slug of its option, as
   **Start as a change** in [Projects](projects.md#starting-postponing-and-dropping-a-feature) says:
   `ura start <draft> --slug <slug> --change`. The answer is the human asking for it, as
   [starting a change](change.md#starting-a-change) requires. Its proposal is the draft, unchanged:
   the human's note, not what the question's context found. Then say to open `/f/<folder>` in the
   web UI, where the change's own session runs: this run does not make the change.

## Agents' notes

An agent working on a feature or a [change](change.md) that finds a problem outside its task or the
change's proposal, like a slow page or a confusing message, does not fix it in passing, and does not
drop it. It adds a note:

- marked `[agent]`, then with the slug of the feature or change the note is about;
- under the category that fits, or a new one named like the others; a review's minor finding, left
  unfixed, goes under **Deferred fixes**;
- with `ura note <text> --agent --about <slug> --category <name>`, or by hand in the default
  branch's checkout, committed alone with `chore: add "<note>" to the inbox`.

Then it names the note in its step's report, and in the pull request when it opens one.
