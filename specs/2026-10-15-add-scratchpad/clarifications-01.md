---
status: awaiting-human
---

# Clarifications, round 01: Scratchpad

> [!IMPORTANT]
>
> 9 questions and 2 follow-ups on capturing and organizing notes, about 35 minutes.
>
> - Where notes live is the choice that lasts: keeping them in `PRIORITIES.md` changes no decision,
>   while a file or a folder of their own changes the git decision, and the attachments one for a
>   folder. Its follow-up only applies to the folder.
> - Who organizes the inbox, and which outcomes a note can have, work together. The "fix it quickly"
>   outcome depends on the bugfixing feature in flight.
> - Gaps in the proposal: whether agents may write notes, what keeps the inbox from growing unread,
>   and how notes with screenshots are captured.
> - Six points are settled without you, at the end, including three small bugs of today's scratchpad
>   that the feature fixes.

## Context

The [proposal](proposal.md) asks for a quick, structured way to write down small feedback and ideas
about the software while using it, kept in the repository, captured first and organized later.

Today the notes are bullets under `## Scratchpad`, at the end of
[`specs/PRIORITIES.md`](/specs/PRIORITIES.md). The tools ignore that section: the web UI does not
show it, ＋ cannot add to it, Draft cannot act on its lines, and editing it on disk confuses the
priorities page. Past notes left it in four ways: grouped into themed drafts, appended to an
existing draft, fixed in passing, or deleted.

Every tool reviewed splits the same way: capture costs one line, and a separate pass gives each item
one outcome from a short list. Their shared pitfall is an inbox nobody processes.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Where do notes live?

Today they are a section of `PRIORITIES.md` that the tools skip. Plain-text tools either keep one
file with one item per line (todo.txt) or one file per item (Backlog.md, BMAD). Only
`PRIORITIES.md`, drafts, and backlog files may be written on the default branch today
([git decision](/specs/decisions/git.md)), and images only in feature, bug, and draft folders
([attachments decision](/specs/decisions/attachments.md)). More in
[discovery](discovery-01.md#where-notes-live).

Why it matters: it decides how much code the feature costs, whether moving a note to a priority or a
draft reuses what exists, and whether a note can hold a screenshot.

- **A (recommended). Notes are a fifth section of `PRIORITIES.md`, `## Inbox` or the name the next
  question picks, at the end of the file, which the tools read like the other four.**
  - [pro] the priorities page, ＋, move, Draft, and remove work on notes with little new code, and
    moving a note to Next is a drag; no decision changes.
  - [con] a note cannot hold an image: one with a screenshot is captured as a draft instead; notes
    and priorities share one file, its version check, and its commit bar.
  - Why recommended: it is the smallest change that makes today's habit a first-class part of the
    tools, and it fits a few dozen one-line notes.
- **B. Notes live in their own file, `specs/INBOX.md`, one bullet per note.**
  - [pro] priorities stay only what is being worked on.
  - [con] a parser, actions, a page, and live updates of their own; every move to a priority crosses
    two files; the git decision changes to allow the file.
- **C. Each note is its own file in a new folder, `specs/inbox/`.**
  - [pro] a note can hold a screenshot and grow into a draft by moving its file.
  - [con] a file and a commit per one-line note, a note format and its checks, a page; the git and
    attachments decisions change.

**Answer:**

### Q1.C: How is a note file named and written?

Only if you picked C in Q1. Backlog.md names files with a number and the title, BMAD with a type and
a slug, superpowers with the date and a slug. More in
[discovery](discovery-01.md#plain-text-and-agent-tools).

- **A (recommended). `specs/inbox/YYYY-MM-DD-<slug>.md`, its first line the note's text, with no
  frontmatter; a note with images becomes a folder, like a draft.**
  - [pro] readable and writable by hand, sorted by age, no format to learn.
  - [con] the slug has to be made from the text at capture.
  - Why recommended: it follows the draft's pattern the project already has.
- **B. The same name, with a frontmatter holding the note's kind (bug, idea, feedback) and its
  source.**
  - [pro] notes can be filtered by kind.
  - [con] a field to fill at capture, against the proposal's focus on capture.

**Answer:**

## Q2: What is the concept called?

The proposal says "scratchpad" and wonders about "Inbox". GTD, Todoist, Things, and OmniFocus all
say inbox for a place items pass through until processed; a scratchpad usually holds working notes
kept as they are. More in [discovery](discovery-01.md#naming).

Why it matters: the name appears in the file, the UI, the commit messages, and the skill.

- **A (recommended). Inbox: `## Inbox`, or the file or folder named after it.**
  - [pro] says that notes are waiting to be sorted, as in the tools users know.
  - [con] can be read as messages received, like an email inbox.
  - Why recommended: it names what the proposal describes, capture then organization.
- **B. Scratchpad, as the proposal and today's section say.**
  - [pro] no rename of a habit.
  - [con] suggests notes stay, which invites the stale pile every source warns about.
- **C. Notes.**
  - [pro] neutral and short.
  - [con] says nothing about sorting them later.

**Answer:**

## Q3: Who organizes the inbox?

The past grouping of notes into three themed drafts was one commit. Linear has a person triage each
item; Next.js had an agent propose a close reason with evidence for each issue, and a human approve
the queue, which found 37% already fixed and 19% duplicates. More in
[discovery](discovery-01.md#organizing).

Why it matters: it decides how much of your time organizing takes, and whether an agent can move
notes into the priorities, which is product direction.

C can come on top of A or B: the UI's actions stay available either way.

- **A (recommended). On request, an agent reads every note against the code, the priorities, and the
  drafts, and writes a proposal as questions, one per note or group of notes, with a recommended
  outcome each: you answer like a clarifications file, and the agent applies the answers and
  commits.**
  - [pro] you decide every outcome, in the answering UI you already use; the agent finds what is
    already fixed, duplicated, or belongs to a draft.
  - [con] a new kind of agent run, and a short round of answers each time.
  - Why recommended: it keeps product direction with you while the agent does the searching, the
    pattern that worked for Next.js.
- **B. On request, an agent organizes the inbox itself and commits; you revert what you disagree
  with.**
  - [pro] the least of your time.
  - [con] an agent placing work in Now or Next decides priorities without you, against
    [principle I](/specs/CONSTITUTION.md#i-humans-stay-in-control).
- **C. You organize by hand, with the UI's existing actions on each note: move to a section, Draft,
  remove.**
  - [pro] nothing new to build beyond the storage.
  - [con] no help finding duplicates, what is already fixed, or which draft a note belongs to.

**Answer:**

### Q3.A: Where does the agent's proposal live until you answer it?

Only if you picked A in Q3. The workflow's question files live in a feature's folder, on its branch;
the inbox is written on the default branch.

- **A (recommended). In one file on the default branch, `specs/INBOX-TRIAGE.md`, in the
  clarifications format, deleted in the commit that applies your answers.**
  - [pro] answered with the existing UI and checks; nothing is left behind once applied; git keeps
    the record.
  - [con] a new top-level file in `specs/`, written on the default branch, which extends the git
    decision's list of such files.
  - Why recommended: it reuses the question format and its tooling, and leaves no branch to clean.
- **B. On a branch of its own, `inbox/YYYY-MM-DD`, merged once applied.**
  - [pro] nothing on the default branch until you answer.
  - [con] a branch and a merge for every pass, and priorities edited off the default branch.

**Answer:**

## Q4: What can a note become?

Past notes became drafts, grouped or appended to existing ones, fixes made in passing, or were
deleted. The [bugfixing feature](/specs/drafts/add-a-bugfixing-low-impact-change-flow.md), in
flight, defines a shorter flow for small changes, the proposal's "fixed quickly without a full dev
flow". More in [discovery](discovery-01.md#outcomes-of-a-note).

Why it matters: it sets the choices of the organizing step, and how this feature depends on the
bugfixing one.

- **A (recommended). A priority entry, a new draft gathering one or more notes, an addition to an
  existing draft, a bug report, or a deletion; and a small change for the bugfixing flow once that
  feature is merged, added by whichever of the two lands second.**
  - [pro] covers every path past notes took, without defining the small-change flow twice.
  - [con] until the bugfixing flow exists, a quick fix goes through a bug report or a draft.
  - Why recommended: each feature keeps its own scope, and neither waits for the other.
- **B. The same outcomes, and this feature defines the small-change path itself.**
  - [pro] quick fixes work from the first version.
  - [con] the same flow designed in two features at once.
- **C. A priority entry, a draft, or a deletion only.**
  - [pro] the smallest set.
  - [con] no path for a note that is a bug, and no addition to an existing draft, the most common
    past outcome.

**Answer:**

## Q5: May agents write notes?

Agents find problems outside their task while they work: today the implementation step writes them
in its rulings, or they are lost. BMAD lets an agent file a ticket from one sentence. More in
[discovery](discovery-01.md#agents-writing-notes).

Why it matters: it decides whether the inbox collects only your feedback, or every out-of-scope
finding.

- **A (recommended). Yes: an agent may add a note for a problem it finds outside its task, marked as
  written by an agent, and says so in its step's report.**
  - [pro] out-of-scope findings land in one place you sort anyway.
  - [con] the inbox grows faster, and agent notes may be noise.
  - Why recommended: a finding kept for you to delete is cheaper than one lost, and the mark lets
    you sort them apart.
- **B. No: only humans write notes.**
  - [pro] the inbox stays your own.
  - [con] agents' findings stay buried in rulings.

**Answer:**

## Q6: Where can a note be captured from?

The web UI's ＋ adds a line to the priorities, from a short form that also works on a phone. The CLI
has no command to add a line. The Neovim plugin's future is in doubt in the current scratchpad. More
in [discovery](discovery-01.md#capture-surfaces).

Why it matters: capture has to be faster than the alternative, writing it nowhere.

- **A (recommended). The web UI's ＋, with the inbox as its default target, and `ura note <text>`
  from any terminal and any agent, both written on the default branch from any checkout.**
  - [pro] reaches the browser, the phone, the terminal, and agents with Q5.
  - [con] a new CLI command.
  - Why recommended: ＋ already exists, and the command is what lets agents write notes without the
    UI.
- **B. The web UI's ＋ only.**
  - [pro] the smallest change.
  - [con] no capture from a terminal, and agents edit the file by hand.
- **C. A, plus a Neovim command.**
  - [pro] capture from the editor too.
  - [con] grows a plugin you may drop.

**Answer:**

## Q7: What does a note hold besides its text?

Things adds a link to the page the user was on; todo.txt can start a line with its date. Old items
carry outdated context, the main reason backlogs rot. Git's history also dates every line, though a
move rewrites it. More in [discovery](discovery-01.md#context-at-capture).

Why it matters: it decides what the organizer knows about a note, and how a note line reads.

- **A (recommended). Its text, plus a link to the feature it is about, added automatically when you
  capture it from a feature's page.**
  - [pro] the organizer knows what the note was about, with nothing to type.
  - [con] a trailing link on some lines.
  - Why recommended: the feature is the context most often lost, and git keeps the date.
- **B. Its text, the capture date, and the feature link.**
  - [pro] the age shows on the line, for spotting stale notes.
  - [con] a date on every line.
- **C. Its text only.**
  - [pro] the cleanest lines.
  - [con] "the x is not centered" says nothing about which page.

**Answer:**

## Q8: What keeps the inbox from growing unread?

Every source warns about this: ProductPlan deleted 600 items unread, Shape Up keeps no backlog at
all. GTD empties its inbox every week. More in [discovery](discovery-01.md#staleness).

Why it matters: an inbox nobody organizes becomes today's scratchpad, with more steps.

- **A (recommended). Home shows the number of notes in the inbox, with a link to organize it.**
  - [pro] seen at every visit, with no rule to set.
  - [con] a number that can be ignored.
  - Why recommended: visibility is enough for one human who organizes when they choose.
- **B. Nothing: you organize when you choose.**
  - [pro] nothing to build.
  - [con] the inbox is out of sight, like today's scratchpad.
- **C. A, plus a nudge once the inbox passes a number of notes or an age.**
  - [pro] a prompt to act.
  - [con] a threshold to pick, and one more thing to dismiss.

**Answer:**

## Q9: How is a note with a screenshot captured?

UI feedback often needs an image, and images are only allowed in feature, bug, and draft folders
([attachments decision](/specs/decisions/attachments.md)). With C in Q1, a note holds its images and
this question needs no answer: write "-". More in [discovery](discovery-01.md#notes-with-images).

- **A (recommended). A note with an image is captured as a draft, from the same ＋ form: adding an
  image turns the note into a draft linked from the inbox.**
  - [pro] no decision changes; the draft keeps the image until the note is organized.
  - [con] a screenshot makes a draft file even for a one-line note.
  - Why recommended: it reuses the draft's image support with no new rule.
- **B. Notes stay text only: a screenshot waits until the note becomes a draft.**
  - [pro] nothing to build.
  - [con] the screenshot is lost at capture, when it is easiest to take.

**Answer:**

## Settled without the human

- **Today's scratchpad** moves into the inbox in the feature's first commit, all eleven notes as
  they are. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Three bugs of today's scratchpad** are fixed: edits made on disk reach the UI live, the commit
  bar counts note changes, and commit messages name them, like `chore: add "<note>" to Inbox`. With
  A in Q1, this follows from reading notes as entries. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Notes are written on the default branch** from any checkout, like the priorities and drafts,
  including while you review a feature's branch. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **The inbox is optional**: `ura check` does not require its section or file, and tools create it
  at the first note, as they create `## Now` today. See
  [discovery](discovery-01.md#needs-no-choice).
- **Parking a note** uses the existing Later section or the backlog, with no snooze. See
  [discovery](discovery-01.md#needs-no-choice).
- **A processed note leaves the inbox** in the same commit as what it became, and a duplicate is
  deleted or gathered into the same draft. See [discovery](discovery-01.md#needs-no-choice).

**Notes:**
