# Data model: Proposal start flow

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## The New page's draft

The browser's unsaved store, mirrored in `localStorage`, one entry per repository. It replaces the
Change card's `new-change` and the Feature card's `new-feature-proposal` entries, which the first
load joins into it, the Change's text first, then removes.

| Field     | Type                                            | Meaning                                                              | Change |
| --------- | ----------------------------------------------- | -------------------------------------------------------------------- | ------ |
| `text`    | string                                          | the composer's text, shared by the three cards                       | New    |
| `sources` | list of `{ kind, id, linked?, text, inserted }` | the lines and notes the text was filled from, and what each inserted | New    |

Images stay with the page, as today: a reload drops them.

## A started feature's proposal

`specs/YYYY-MM-DD-<slug>/proposal.md`, as a typed feature start writes it. Today only a proposal
file's start makes one, moved unchanged.

| Field             | Type                        | Meaning                                                            | Change |
| ----------------- | --------------------------- | ------------------------------------------------------------------ | ------ |
| `discovery`       | `low`, `medium`, `high`     | the research effort picked in the start dialog, in the frontmatter | New    |
| The heading       | `# <title>`                 | the text's first written line, cut at 80 characters                | New    |
| The body          | markdown                    | the rest of the text, as typed, with the line's nested lines       | New    |
| The images' links | `![Image N](images/<file>)` | one per image, at the end, the files in the folder's `images/`     | New    |
