# Inbox

Where the human, and agents, write down small things noticed about the software, and how those notes
are organized later.

## What the inbox is for

A misaligned icon, a confusing command, an idea: things worth keeping, noticed while doing something
else, and not priorities yet. The human writes them down in a few seconds and goes back to what they
were doing. Notes wait in `specs/INBOX.md`, grouped under categories the human names, until someone
decides what each becomes: a priority, a draft, part of an existing draft, a bug, or nothing.

The inbox is optional. A project without `INBOX.md` has no notes, and the first note creates it.

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

- **Note**: a line starting with `- ` or `* ` at column 0, with the lines indented under it. Its
  text is the line after the marker and the marks. A note linking a draft is a markdown link
  covering its whole text.
- **Marks**: leading groups `[agent]`, then `[<slug>]`, each followed by one space. A slug is
  lowercase letters, digits, and `-`. Any other bracket, like `[!]`, is text.
- **Category**: a `## ` heading; its name is the heading's text. Notes before the first `##` have no
  category. Other headings and text are kept and ignored.

The `[agent]` mark says an agent wrote the note. The slug is the folder of the feature or bug the
note is about, without its date: `[run-ui]` for `2026-10-14-run-ui`. Lines inside fenced code are
not notes, a fence indented under a note is part of it, and a `###` heading does not end a category.
A category's name appears once: tools add to the first heading of a name, and `ura check` reports a
repeated one. A category left empty keeps its heading.

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
  `ura note <text> [--category <name>] [--about <feature or bug>] [--agent] [--no-commit]` writes
  and commits the note on the default branch, and writes without committing when `INBOX.md` has
  other changes. `--about` writes the slug of the target's folder; inside a feature's worktree, it
  defaults to that feature.
- **In the web UI**: the ＋ next to Inbox in the sidebar, from any page. From a feature's page, the
  note gets that feature's slug. It stays uncommitted until the commit bar's Commit. A note with an
  image becomes a draft that holds it, and the note links to the draft.
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
- **Nothing**: the note is deleted. A note linking a draft loses its line only: the draft stays.

A note can also have its text edited, its marks kept, or move to another category.

Commit `INBOX.md` with the files the notes went into, and nothing else. The message names the one
change, with the note's text shortened like a priorities entry: `edit "<note>" in the inbox`,
`remove "<note>" from the inbox`, `move "<note>" to <Category> in the inbox`, with `No category` for
none, `move "<note>" from the inbox to <Section>`, or
`move "<note>" from the inbox to the draft <title>`, each with `chore:`. A note counts as moved only
when the entry or the draft's line has its exact text: one edited on the way is a removal and an
addition. With more changes, `PRIORITIES.md`'s included, the subject names the first one and ends
with `, and <count> more`, and the body lists every change, one per line, the inbox's first:
`- Move from the inbox to Next: <note>`, `- Remove from the inbox: <note>`. See
[Commits](conventions.md#commits).

## The triage

When the inbox is large or messy, the human asks an agent to propose what each note becomes. The
agent writes the proposal as questions in `specs/INBOX-TRIAGE.md`, the human answers them like a
round of questions, and an agent carries out the answers. Both runs happen in the default branch's
checkout, and need no feature.

### Proposing a triage

1. **Refuse a second triage.** When `specs/INBOX-TRIAGE.md` exists, stop and say: "An inbox triage
   already waits: answer or delete specs/INBOX-TRIAGE.md first."
2. **Read every note against the project**: the code it is about, `PRIORITIES.md`, the drafts and
   the backlog, and the open feature and bug branches. A note may be done already, a duplicate, or
   part of a draft.
3. **Write `specs/INBOX-TRIAGE.md`** from [the template](../assets/templates/specs/INBOX-TRIAGE.md),
   with `status: awaiting-human`:
   - The `> [!IMPORTANT]` block, as in
     [Coming back to the human](../SKILL.md#coming-back-to-the-human): its first line gives the
     questions, the notes they cover, and the time, "8 questions on 11 notes, about 15 minutes".
   - **Context**: how many notes the inbox holds, and what you read.
   - **One question per note, or per group of notes** that go to the same place. A question names
     its notes by their text, quoted, so the human, and the agent that applies it, find them without
     line numbers. Its options, the recommended one first, are among these: a priorities section, a
     new draft, an existing draft named by its title, a bug, deletion, or keeping it in the inbox. A
     bug option names the slug it would use.
   - **Notes:**, last, for the human. A triage has no points settled without the human: every
     outcome is theirs.
4. **Commit** `specs/INBOX-TRIAGE.md` alone, with `chore: propose an inbox triage`, and the block's
   first line as the body. Stop: the triage waits for the human.

The human answers it like any round, and commits it with `chore: answer the inbox triage`. With
`ura`, `ura answer` records the answers.

### Applying the answers

Once `INBOX-TRIAGE.md` is `answered`:

1. **Carry out each answer** on the notes it names, found by their text in `INBOX.md` as it is now,
   as [organizing by hand](#organizing-by-hand) does. A note added after the triage was written
   stays in the inbox, untouched. A note the triage names that is no longer there is skipped.
2. **Commit once**: `INBOX.md`, `PRIORITIES.md`, the drafts the notes went into, and the deletion of
   `INBOX-TRIAGE.md`, with `chore: apply the inbox triage`. The body lists what each note became,
   one per line, and the notes skipped, with why.
3. **Start each bug** an answer asked for, from its note, as [starting a bug](bug.md#starting-a-bug)
   says, with the slug of its option: the answer is the human asking for it.

## Agents' notes

An agent working on a feature or a bug that finds a problem outside its task, like a slow page or a
confusing message, does not fix it in passing, and does not drop it. It adds a note:

- marked `[agent]`, then with the slug of the feature or bug the note is about;
- under the category that fits, or a new one named like the others;
- with `ura note <text> --agent --about <slug> --category <name>`, or by hand in the default
  branch's checkout, committed alone with `chore: add "<note>" to the inbox`.

Then it names the note in its step's report, and in the pull request when it opens one.
