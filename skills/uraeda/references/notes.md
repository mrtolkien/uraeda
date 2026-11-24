# Notes

What the human keeps outside git, and what agents write there: ideas, the inbox, priorities,
proposals not started yet, the wiki, and each feature's research recap.

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
    libraries/                   # code dependencies
      date-fns/                  # a subject with several notes is a folder
        date-fns.md              # its own note, named after the folder
        javascript-date-24-hours-is-not-a-day.md   # one surprise per note
    apps/                        # a tool the project uses, or a feature's model: todoist.md
    standards/                   # specs, protocols, formats the project implements: indexeddb.md
    topics/                      # a kind of feature, with the products compared: recurring-dates.md
  projects/<repository>/
    proposals/                   # human: one note per proposal, a folder when it has images
      keyboard-shortcuts.md
    research/                    # agents: one short recap per feature
      2026-10-06-recurring-tasks-research.md
    specs/                       # with ura's sync: the repository's workflow files, to read
  inspiration/   docs/           # the human's own folders: read them, never write there
```

The [example's notes](../assets/example/notes/) are a filled-in vault: the proposals and inbox of a
todo app, the research recap of its recurring tasks, and the wiki notes that round wrote.

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
a gotcha's name starts with what it is about. Files in git keep markdown links, and link a note only
as further reading.

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

A notes app shows them as a board: an Obsidian base with a column per `status`, its cards in the
order of `rank`, which the human sets by dragging a card and never reads. No file lists the
priorities: the proposals' fields are the list.

An agent edits a proposal note in three cases only, and only its frontmatter: it sets
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
how a kind of feature works across products, what a standard says, what surprised someone. It saves
the next search, not the next check.

It is the only long form of a discovery's research: the [recap](#the-research-recap) is one page,
and the round's file in git keeps only what its questions rely on. So a note is written to be found
and trusted by an agent who never saw the round.

### What earns a note

A note costs every later agent a line to read in each listing, and a wiki of notes nobody needs
hides the ones that matter. A round that compares thirteen products writes one topic, not thirteen
notes. Write a note only for one of these:

- **Something the project builds with, or will after this round**: a dependency, a tool, a standard
  it implements, the product the feature is modelled on.
- **A surprise in one of those**, read at its source or shown by a run: a gotcha.
- **How a kind of feature works across products**, when a question of the round relied on the
  comparison: a topic.

Everything else is a line of a note that earned its place, or nothing:

- **A product that was only compared** is a row of the topic's table, with its source. It gets no
  `apps/` note: a note named `google-calendar` that covers only how it repeats events misleads the
  agent who opens it for anything else.
- **A library or a standard that was read and not chosen** is one line of the topic: its name, its
  state on that day, why not, and the source.
- **A fact about how another product is designed** is not a gotcha, however striking. A gotcha is
  what the project's own code would hit.
- **What only this feature needs** stays in the round's discovery file.

### One home per fact

A fact is written in one note, with its source. Every other note that needs it links there, and does
not say it again: a fact copied in four notes is corrected in one and wrong in three.

- A surprise lives in its gotcha, a note of its own in its subject's folder. The subject's note
  lists it under **Gotchas**, by link.
- A product's behaviour lives in the topic's table. A library's note says "see [[recurring-dates]]".
- A library's version and state live in the library's note.

### Where a note goes

Each subject has one home folder, by its kind, and links carry everything else:

- `libraries/`: a dependency the code uses: what it does, its versions, its behaviours that matter.
- `apps/`: a tool the project uses, or the product a feature is modelled on, studied whole enough to
  be read for another feature.
- `standards/`: a specification, a protocol, or a file format the project implements or reads.
- `topics/`: how a kind of feature works across products: what users expect, where products differ,
  with the products compared as rows of a table, and the options read and not chosen.

Keep these four folders. There is no folder of gotchas: a surprise is found where its subject is.

### Small notes, in the subject's folder

A note holds one subject, or one surprise, and a subject grows by notes, not by length. The wiki's
first readers are agents, and small notes serve them twice:

- **A listing is the index.** `ura vault ls` shows each note with its `description`, so an agent
  reads a line per note and opens only the one it needs. Write a gotcha's `description` as the
  surprise itself, not as its title: "postcard accepts redundant bytes, so decode then re-encode may
  change the bytes a signature covers".
- **Two agents never write the same note.** A write replaces the whole file: two sessions adding a
  surprise to one long note would lose one of them, and two new files cannot collide.

- **A subject with one note is a file**: `libraries/postcard.md`.
- **A subject with more is a folder**, named after it, holding its own note under the same name and
  the others beside it:

  ```sh
  libraries/date-fns/
    date-fns.md                                  # what it is, its version, links to the rest
    javascript-date-24-hours-is-not-a-day.md     # a gotcha: one surprise
  ```

  Whoever writes a subject's second note makes the folder: write the subject's note at its new path,
  then remove the old one. Its name does not change, so every wikilink still resolves.

- **A gotcha is one note**: what happens, when, and what to do instead. Its name starts with what it
  is about and says what happens. It goes in the folder of the subject whose code would hit it,
  which lists it under **Gotchas**. One that touches two subjects lives with the one the project's
  code calls, and the other links it. One with no library, app, or standard of its own goes in its
  topic's folder.
- **A subject's note that grows long is split the same way**: each part becomes a note of the
  folder, `iroh-relays.md`, and the subject's note keeps a few lines and the links.

Never deeper than a subject's folder: a note is found by its subject and its name.
`ura vault ls wiki/libraries` shows each subject, file or folder, with its description, and
`ura vault ls wiki/libraries/date-fns` its notes.

### A note

Written from [the template](../assets/templates/notes/wiki-note.md):

- **Frontmatter**: `description`, one line that says what the note is for, which every listing
  shows; `checked`, the day its sources were last read; `sources`, their addresses; and `version`
  for a library or an app, what its facts hold for.
- **The body** is free: what it is in a sentence or two, then the facts, each with its source, and
  wikilinks to the notes it relates to. A gotcha says what happens, when, and what to do instead.
- **No empty section, and no filler**: a note with no gotcha has no **Gotchas** heading, never "none
  recorded". A note does not link the recap or the round that wrote it: the recap links the note,
  and the notes app shows that link from both ends.

Before writing a note, list its folder: extend a note that exists rather than adding a second one on
the same subject. Change a fact in place, with its new source and date, rather than adding a
contradicting line below it. A note no other note links is fine: its folder and name find it.

### Who writes it

In a discovery round, the wiki and the recap are written by a sub-agent, from
[its brief](../assets/templates/notes/wiki-writer-brief.md), while the agent that did the research
writes the questions: see [the notes](discovery.md#the-notes-the-wiki-and-the-recap). Agents that
research a topic for a round return their findings to the agent that asked, and write nothing in the
notes: a note written by each of them is the same fact written six times.

In any other step, an agent that learns something that earns a note writes it itself, by the same
rules.

### Reading it

Read the wiki in any step, when it may hold what you are about to search: list a folder, read the
notes whose descriptions match. Its facts are leads. A fact that a question, the spec, or the plan
relies on is read again at its source, in this session, and the file in git cites that source, never
the wiki.

No index of the wiki is written by hand: it would drift. A listing is made when it is needed, from
the notes' `description`: `ura vault ls wiki/libraries`, or the notes app's own view.
`ura vault check` reports broken wikilinks and notes without a `description`.

## The research recap

Each feature has one recap, in `projects/<repository>/research/`, named after the feature's folder,
`2026-10-06-recurring-tasks-research.md`, from
[the template](../assets/templates/notes/research.md). It is for the human: one page that says what
the research looked at and what it learned, in plain sentences, each linking the wiki note that
holds the detail.

- **One file for the whole feature.** A later round adds its own short section and corrects **What
  we learned** in place. It never starts a second file.
- **Short.** A page: a few sentences, then at most seven things learned, then a few lines per round.
  No table, no list of sources, no approaches compared: the sources are in the wiki's notes, the
  findings in the round's `discovery-NN.md` in git, and the options in the questions.
- **Every note the round wrote or changed is linked**, as a wikilink, where the recap says what was
  learned from it. A note that fits no sentence is listed in its round's section.
- **Readable alone**, by someone who has not read the proposal that day: no term the wiki's notes
  coined, no file path beyond the discovery file's.
