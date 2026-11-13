# Inbox

Where the human, and rarely an agent, writes down small things noticed about the software, and how
those notes are organized later.

A misaligned icon, a confusing command, an idea: things noticed while doing something else, and not
proposals yet. The human writes them down in seconds, while using the product. They are their raw
reactions to what was built: read the notes about an area before working on it. Notes wait in
`specs/INBOX.md`, under categories the human names, and agents' notes in files of their own in
`specs/notes/`, until the human decides what each becomes: a proposal, part of one, a change, or
nothing.

The inbox is optional: the first note creates `INBOX.md`.

## The format

`specs/INBOX.md`, on the default branch:

```md
# Inbox

- We'll need a model selector for each step

## UI

- [run-ui] In failures the `x` is not centered in the circle
- [agent] [session-view] Opening a session with 2,000 messages takes 4 s
- [The spec page's headings are body-sized](notes/the-spec-pages-headings-are-body-sized/note.md)
```

- **Note**: an item at column 0, with the lines indented under it. A note with a note file is a
  markdown link to it, in `specs/notes/`, covering its whole text.
- **Marks**: leading groups `[agent]`, then `[<slug>]`, the folder of the feature or change the note
  is about, without its date. Any other bracket is text.
- **Category**: a `## ` heading. Notes before the first one have no category. A category's name
  appears once.
- **Agent's note**: a note file of `specs/notes/` that no link of `INBOX.md` reaches, `<name>.md` or
  `<name>/note.md`. It shows at the end of its category. Its fields are optional:

  ```md
  ---
  agent: true
  about: feature-state
  category: Deferred fixes
  ---

  # The workspace record's `running` is read by no view

  Remove it, or name what reads it (`packages/server/src/fate/sources.ts`).
  ```

  `agent: true` is the `[agent]` mark, `about` the `[<slug>]` mark, and `category` its category. A
  value YAML would misread is double-quoted. Its `# ` title is its text.

Edit the file line by line: every line you do not change keeps its bytes. `ura inbox` prints every
note by category, agents' notes included.

## Capture

The human's notes are written on the default branch, one line per note, at the end of its category:
with `ura note <text> [--category <name>] [--about <feature or change>]`, or
[by hand](by-hand.md#write-a-note). A note with images gets a note file: see
[images on a note](by-hand.md#images-on-a-note).

## Organizing

The human decides what each note becomes: a proposal in a section of `PRIORITIES.md`, a new proposal
file, a line of an existing one, a change, or nothing. Each outcome moves the note out of `INBOX.md`
in the same commit as what it became: [what a note becomes](by-hand.md#what-a-note-becomes) has each
move. Starting a change makes a branch, which only the human asks for.

## The triage

When the inbox is large, the human asks an agent to propose what each note becomes. The agent writes
its outcomes as questions in `specs/INBOX-TRIAGE.md`, the human answers them like a round, and an
agent carries out the answers. Both runs happen in the default branch's checkout.

### Proposing a triage

1. **Refuse a second triage.** When `specs/INBOX-TRIAGE.md` exists, stop and say: "An inbox triage
   already waits: answer or dismiss specs/INBOX-TRIAGE.md first."
2. **Read every note against the project**: the code it is about, `PRIORITIES.md`, the proposal
   files, and the open branches. A note may be done already, a duplicate, or part of a proposal.
3. **Write `specs/INBOX-TRIAGE.md`** from [the template](../assets/templates/specs/INBOX-TRIAGE.md),
   with `status: awaiting-human`, as [a round of questions](writing.md#a-round-of-questions) says,
   with a free Context and no settled points:
   - **The block**: its first line gives the questions, the notes they cover, and the time: "8
     questions on 11 notes, about 15 minutes".
   - **Context**: how many notes the inbox holds, how many the triage covers, and what you read.
     When the notes are too many for one sitting, cover whole categories, and say which wait.
   - **One question per note, or per group of notes that go to the same place.** Group hard: the
     human wants few questions. A question quotes its notes whole, word for word, so they are found
     without line numbers. Its options, the recommended one first, are among: a proposal in a
     section of `PRIORITIES.md`, a new proposal file, an existing proposal file, a change, deletion,
     or keeping it in the inbox. A new proposal file option names its title and the section that
     links it. A change option names its proposal file's title and the slug it would start with. A
     question's heading names its notes by their subject, not by a quote.
   - **Links** only to files on the default branch.
   - **Notes:**, last, for the human.
4. **Commit** it alone, with `chore: propose an inbox triage`, and the block's first line as the
   body. Stop: the triage waits for the human.

A triage only organizes: it changes no code, however quick the fix looks.

The human answers it like any round, and commits it alone with `chore: answer the inbox triage`.
`ura answer` answers features' rounds only.

### Dismissing a triage

A triage the human no longer wants is dismissed, answered or not: delete `specs/INBOX-TRIAGE.md`,
and commit its deletion alone with `chore: dismiss the inbox triage`. Ask first when it holds
answers not committed yet.

### Applying the answers

Once `INBOX-TRIAGE.md` is `answered`:

1. **Carry out each answer** on the notes it names, found by their text in the inbox as it is now. A
   new proposal file takes its option's title, and every grouped note's lines, word for word, as its
   What. A change's proposal file is linked from **Now**, first after the started proposals. A note
   added since stays in the inbox, and one no longer there is skipped. What the human wrote in an
   answer, "only fix the important ones", goes into the proposal file it leads to, in their words:
   it is the intent of the work that follows.
2. **Commit once**: `INBOX.md`, `PRIORITIES.md`, the proposal files the notes went into, and the
   deletion of `INBOX-TRIAGE.md`, with `chore: apply the inbox triage`. The body lists every note
   the triage names, one per line, with what became of it.
3. **Start each change** an answer asked for, from its proposal file, with the slug of its option,
   `ura start <proposal> --slug <slug> --change`, as
   [starting a change](change.md#starting-a-change) says: the answer is the human asking for it.
   Then say that the change is started, in its own worktree: this run does not make the change.

## Agents' notes

An agent's note is exceptional. The human reads every note and decides what it becomes, so each one
costs their attention. Most features and changes add none.

What an agent finds while working goes one of three ways:

- **The work needs it**: a problem in what the branch builds, or one the approved work cannot ship
  without. Fix it on the branch.
- **It passes the two tests below**: add a note.
- **Neither**: drop it. It goes nowhere: not in the inbox, not in `rulings.md`, not in the pull
  request. A review's minor findings are fixed or dropped the same way, and its important ones are
  never dropped, as [grade the findings](implementation.md#grade-the-findings) says.

The two tests:

1. **It is important**: users lose data, time, or trust, a security guard is missing, or every later
   change will pay for it. A name, a style preference, or a function near a size limit is not. When
   in doubt, it is not: drop it.
2. **It needs the human, because it clearly falls outside the feature or change**: fixing it would
   grow the scope they approved, or it takes their choice.

A note is a note file of its own, never a line of `INBOX.md`, written in the branch's own worktree:
with `ura note <text> --agent --about <slug> --category <name>`, or by hand as
`specs/notes/<slug>-<first words>.md`, a name no file has yet, with the frontmatter above. It is
committed alone, with `chore: add "<note>" to the inbox`, and reaches the default branch with the
merge. Name it in the pull request.
