# Notes

What the human keeps outside git, and what agents write there: ideas, the inbox, priorities,
proposals not started yet, the wiki, and the research behind each round.

These change daily, from a phone, and would fill the repository's history with commits nobody
reviews. So they live in the human's notes, as plain text, and nothing in git depends on them: the
constitution allows it. A feature enters git when it starts, as its proposal, and leaves its record
there when it merges.

Any notes app that keeps plain markdown files works, and so does a folder with no app at all. This
file uses an Obsidian vault as the example. With `ura`, the human's notes are one vault for every
repository, which `ura serve` syncs to the phone, and `ura vault` reads and writes for agents.
Without `ura`, read and write the files where the project's instructions say the notes are. When you
know of no notes, write nothing there: say in your last message what you would have written.

## The layout

```sh
vault/
  inbox/                         # human: one note per capture, any project
    sort-completed-tasks.md
  wiki/                          # agents: what was learned, shared by every repository
    libraries/                   # code dependencies: date-fns.md
    apps/                        # products and tools, as models or as tools: todoist.md
    standards/                   # specs, protocols, formats: rfc-5545-recurrence.md
    topics/                      # how a kind of feature works across products: recurring-dates.md
    gotchas/                     # one surprise each, named after its subject first
  projects/<repository>/
    proposals/                   # human: one note per proposal, a folder when it has images
      keyboard-shortcuts.md
    research/                    # agents: each discovery's long report
      2026-10-06-recurring-tasks-01.md
    specs/                       # with ura's sync: the repository's workflow files, to read
  inspiration/   docs/           # the human's own folders: read them, never write there
```

The [example's notes](../assets/example/notes/) are a filled-in vault: the proposals and inbox of a
todo app, the research of its recurring tasks, and the wiki notes it wrote.

`projects/<repository>/specs/` exists only where a sync shows the repository's workflow files in the
notes: the constitution, the decisions, and the folders of features in progress, from their
worktrees. They are git's files, read there: a round is answered and a spec reviewed as the workflow
says, and an agent never edits them through the notes.

`<repository>` is the repository's folder name. Each folder has one owner. The human owns the inbox,
the proposals, and their own folders: an agent writes there only what this file names. Agents own
the wiki and the research, and the human may edit them: read a note again before you change it.

**Links in the notes are wikilinks**, `[[todoist]]`,
`[[javascript-date-24-hours-is-not-a-day|a day is not 24 hours]]`: the human edits these files, and
Obsidian keeps wikilinks right when a note moves. So a note's name is unique in the whole vault, and
a gotcha's name starts with its subject. Files in git keep markdown links, and link a note only as
further reading.

## Proposals and priorities

A proposal is one note of `projects/<repository>/proposals/`, free form, from
[the template](../assets/templates/notes/proposal.md): its title, a **What**, a **Why**, optional
**Notes**, and the images it links beside it, in a folder of its own. Its frontmatter is the board:

| Field       | Values                                 | Set by                                               |
| ----------- | -------------------------------------- | ---------------------------------------------------- |
| `discovery` | `low`, `medium`, `high`                | the human: how far the research goes                 |
| `status`    | `idea`, `later`, `next`, `now`         | the human                                            |
| `status`    | `started`, `postponed`, `done`         | the agent that starts, postpones, or finds it merged |
| `rank`      | a number, lowest first within a status | the human                                            |
| `branch`    | the feature's branch, once started     | the agent that starts it                             |

A notes app shows them as a board: an Obsidian base grouped by `status`, sorted by `rank`. No file
lists the priorities: the proposals' fields are the list.

An agent edits a proposal note in two cases only, and only its frontmatter: it sets
`status: started` and `branch` when it [starts](projects.md#starting-a-feature) the feature, and
`status: postponed` when it [postpones](projects.md#postponing-or-dropping-a-feature) it, and
`status: done` when it finds the feature's record on the default branch and the note still
`started`. The human's words are never changed.

## The inbox

The inbox is the human's: one note per thing noticed, written in seconds while using the product, a
misaligned icon or an idea. A note may say its project in `project`, and holds its images beside it.
The human decides what each becomes, and moves it: a proposal, a line of one, or nothing. An agent
working on an area reads the inbox's notes about it: they are the human's raw reactions to what was
built.

### Agents' notes

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

A note is a new file of `inbox/`, never an edit of another note: a title that says the problem, then
what you found and where, with links to the code as paths. Its frontmatter says `from: agent`,
`project: <repository>`, and `feature: <the feature's or change's folder>`. With `ura`,
`ura vault write inbox/<name>.md`. Name it in the pull request's "Look at", and in the record's
**Follow-ups**: a project without notes keeps it there alone.

## The wiki

The wiki is what agents learned, kept for the next agent, in any repository: how a library behaves,
how a product does a feature, what a standard says, what surprised someone. It saves the next
search, not the next check.

### Where a note goes

Each note has one home folder, by its kind, and links carry everything else:

- `libraries/`: a dependency the code uses: what it does, its versions, its behaviours that matter.
- `apps/`: a product or a tool, studied as a model or used as a tool.
- `standards/`: a specification, a protocol, or a file format.
- `topics/`: how a kind of feature works across products: what users expect, where products differ.
- `gotchas/`: one surprising behaviour, the kind a record lists, linking the library, app, or
  standard it is about, which links it back.

Keep these five folders. A folder grows a level only when it is crowded, by family:
`libraries/rust/`. Never deeper: a note is found by its folder and its name.

### A note

Written from [the template](../assets/templates/notes/wiki-note.md):

- **Frontmatter**: `description`, one line that says what the note is for, which every listing
  shows; `checked`, the day its sources were last read; `sources`, their addresses; and `version`
  for a library or an app, what its facts hold for.
- **The body** is free: what it is in a sentence or two, then the facts, each with its source, and
  wikilinks to the notes it relates to. A gotcha says what happens, when, and what to do instead.

Before writing a note, list its folder: extend a note that exists rather than adding a second one on
the same subject. Change a fact in place, with its new source and date, rather than adding a
contradicting line below it. A note no other note links is fine: its folder and name find it.

### Reading it

Read the wiki in any step, when it may hold what you are about to search: list a folder, read the
notes whose descriptions match. Its facts are leads. A fact that a question, the spec, or the plan
relies on is read again at its source, in this session, and the file in git cites that source, never
the wiki.

No index of the wiki is written by hand: it would drift. A listing is made when it is needed, from
the notes' `description`: `ura vault ls wiki/libraries`, or the notes app's own view.
`ura vault check` reports broken wikilinks and notes without a `description`.

## Research reports

Each discovery round writes its long report in `projects/<repository>/research/`, named after the
feature's folder and the round, `2026-10-06-recurring-tasks-01.md`, from
[the template](../assets/templates/notes/research.md): how other products do it, the standards and
libraries, and the approaches compared, each fact with its source, linking the wiki's notes it used
or wrote. The round's `discovery-NN.md`, in git, keeps what its questions rely on: see
[the discovery file](discovery.md#the-discovery-file).

A report is written once, for its round. What lasts beyond the feature also goes into the wiki, in
the same step: a product's behaviour into its `apps/` note, a library's surprise into a gotcha.
