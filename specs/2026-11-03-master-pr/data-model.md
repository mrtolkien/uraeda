# Data model: "Master" PR

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## Agent's note file

A note file of `specs/notes/` that no note of `INBOX.md` links. It is a note of the inbox on its
own, at the end of its category. An agent writes one per note, on its branch, named
`<slug>-<words>.md`: the slug of the feature or change it is about, then the note's first words. Two
branches never pick the same name, since their slugs differ.

```md
---
agent: true
about: feature-state
category: Deferred fixes
---

# The workspace record's `running` is read by no view

Remove it, or name what reads it (`packages/server/src/fate/sources.ts`).
```

| Field      | Type    | Meaning                                                               | Change |
| ---------- | ------- | --------------------------------------------------------------------- | ------ |
| `agent`    | boolean | the `[agent]` mark: an agent wrote the note                           | New    |
| `about`    | slug    | the feature or change the note is about, as the `[<slug>]` mark       | New    |
| `category` | text    | the inbox category it shows under; none, or one `INBOX.md` lacks, too | New    |
| `# ` title | text    | the note's text, as a linked note file's title is today               |        |
| body       | text    | the note's further lines, as a note file's are today                  |        |

All three fields are optional, so a human can write one by hand. A note file that a note of
`INBOX.md` links ignores them: the line carries its marks and its category, as today.

## `INBOX.md`

Unchanged in format. It no longer receives agents' notes: only the human writes it, on the default
branch.

## `PRIORITIES.md`

Unchanged in format. Branches no longer write it: a merged feature's line, linking
`/specs/<folder>/proposal.md`, stays until `ura clean` removes it.
