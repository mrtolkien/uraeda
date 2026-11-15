# Brief: write the wiki and the recap of a discovery round

[The agent that ran the round fills the four lines under "This round", and gives this whole file to
a sub-agent as its task. Nothing below them changes.]

## This round

- **Feature**: [YYYY-MM-DD-feature-slug], round [NN], in the repository [repository]
- **The round's findings**: [path of `discovery-NN.md` in the feature's worktree]
- **The research behind them**: [paths of the files, outside git and outside the notes, where the
  research agents' full findings were kept, or "in the discovery file alone"]
- **What the project builds with after this round**: [the dependencies, tools, and standards the
  feature will use under the recommended options, and the product it is modelled on, if any]

## Your task

You write two things in the human's notes, and nothing else: the wiki notes this round earned, and
the feature's research recap. You do no new research: every fact you write is in the files above,
with its source. You read a source again only to check a fact you are about to write.

Another agent is writing the round's questions at the same time. Do not write in the repository, and
do not write in the inbox or the proposals.

Read `references/notes.md` of the skill first, from **The wiki** to its end: it is the rule for
everything below. The commands below are `ura`'s. Without `ura`, read and write the same files where
the project's instructions say the notes are.

## 1. List what the round learned

Read the round's findings and the research behind them. List every product, library, standard, kind
of feature, and surprise they cover.

## 2. Decide what earns a note

Sort each item of your list, by **What earns a note**:

| The item is                                                | It becomes                          |
| ---------------------------------------------------------- | ----------------------------------- |
| something the project builds with after this round         | a note in its folder                |
| a surprise in one of those, read at its source or run      | a gotcha                            |
| how a kind of feature works across products, in a question | a topic                             |
| a product that was only compared                           | a row of the topic's table          |
| a library or a standard read and not chosen                | one line of the topic, with why not |
| a striking fact about how another product is designed      | a line of the topic                 |
| needed by this feature alone                               | nothing: it is in the discovery     |

When you hesitate between a note and a line, it is a line. Most rounds write a handful of notes. A
round that would write more than fifteen is sorting wrong: read the table again.

## 3. Write the notes

For each note, in this order: topics, then libraries, apps, and standards, then gotchas.

1. List its folder, `ura vault ls wiki/<folder>`, and read any note on the same subject. Extend it,
   and correct its facts in place, rather than writing a second one.
2. Write it from `assets/templates/notes/wiki-note.md`, with
   `ura vault write wiki/<folder>/<name>.md`.
3. Give each fact one home, with its source beside it. Where another note needs it, link there.
4. Leave out every empty section, and every link to the recap or to the round.

A note's name is unique in the whole vault, in lowercase with hyphens. A gotcha's name starts with
its subject and says what happens: `date-fns-add-months-clamps-to-the-last-day`.

## 4. Write the recap

One file for the whole feature, `projects/<repository>/research/<feature folder>-research.md`, from
`assets/templates/notes/research.md`.

- **Round 01**: write it whole.
- **A later round**: read the file, correct **What we learned** in place, and add this round's
  section under the earlier ones.

It is for the human, and it is one page. Write what was learned as plain sentences, and link each
note where its sentence is. No table, no source, no approach compared.

## 5. Check, and report

1. Run `ura vault check`, and fix every broken wikilink and every note without a `description`.
2. Read each note you wrote once more, as an agent of another repository would: is its name what
   they would look for, and is every fact true without this feature's context?
3. Count the facts you wrote twice, and move each to its one home.

Then reply with, and only with:

- the notes you wrote, and the notes you changed, by path;
- the recap's path;
- what you left out, in one line per kind: "2 products, as rows of `recurring-dates`";
- anything in the findings you could not place, or that contradicts a note already in the wiki.
