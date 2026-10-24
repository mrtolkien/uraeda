# Data model: Questions page in the terminal look

The file format that [the spec](spec.md) changes: a round of questions, `clarifications-NN.md`, in a
feature's or a change's folder. Nothing else is stored: the right column's width and the folded
Today pane live in the browser, as other UI preferences do.

## A round of questions

The sections of the file, in order. "Check these" leaves the settled points for a section of its
own, before the first question, so the file reads in the order the page shows it.

| Section                           | Holds                                                                                                       | Change                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `# Clarifications, round NN: ...` | The title                                                                                                   |                                                         |
| `> [!IMPORTANT]` block            | The count and time, the verdict, what matters most                                                          |                                                         |
| `## Context`                      | `### Since the last round`, `### Goal`, `### Today`, `### Scope`, `### Sources`                             |                                                         |
| `## Check these`                  | The points to check, each a list item starting with its bold subject, no sub-heading; left out when empty   | New, before the first question                          |
| `## Q1: ...`, `### Q1.B: ...`     | The questions and their follow-ups                                                                          |                                                         |
| `## Settled without the human`    | `### Behaviour`, then `### Under the hood`, each left out when empty; the section is left out when both are | Changed: no `### Check these`                           |
| `**Notes:**`                      | The human's free notes, then their comments on settled points                                               | Changed: a comment may name a point of `## Check these` |

## A comment on a settled point

Unchanged in form: a bullet at the end of the notes, starting with the point's bold subject,
`- **The light flow stays.**: Keep it, but say so in the PR.` The subject may now be one of
`## Check these` as well as of the settled section. Subjects stay unique in the round.

## What `ura check` reports

| Check              | Reports                                                                                      | Change  |
| ------------------ | -------------------------------------------------------------------------------------------- | ------- |
| `sections.order`   | `## Check these` anywhere but between `## Context` and the first question                    | Changed |
| `sections.unknown` | A `### Check these` under `## Settled without the human`, as any unknown sub-heading         | Changed |
| `settled.group`    | A point under `## Settled without the human` outside `### Behaviour` or `### Under the hood` | Changed |

Before version 1.0, the [compatibility](/specs/decisions/compatibility.md) decision keeps no reader
for the old order: rounds in the old format fail `ura check` until they are rewritten.
