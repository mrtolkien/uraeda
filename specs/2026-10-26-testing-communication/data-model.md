# Data model: Testing strategy review

The file formats that [the spec](spec.md) adds or changes: a record's links and sections, a spec's
list of replaced behaviour, and a ruling's fields. Internal types are the plan's.

## Record (`specs/done/YYYY-MM-DD-<slug>.md`)

| Field / section             | Type                           | Meaning                                                                  | Change  |
| --------------------------- | ------------------------------ | ------------------------------------------------------------------------ | ------- |
| `supersedes`                | list of record names, or empty | the older records whose behaviour this one replaces, in whole or in part | New     |
| `superseded-by`             | list of record names, or empty | the newer records that replace behaviour this one describes              | New     |
| note under the title        | one line                       | "Superseded in part by [record]", for each `superseded-by`               | New     |
| `## Replaced behaviour`     | list, optional                 | the behaviour the feature replaced, with the tests that guarded it       | New     |
| `## Gotchas`                | list, optional                 | what the code and tests do not show, next to the choice it shaped        | New     |
| `## Changes after approval` | list, optional                 | now also holds the rulings that change behaviour                         | Changed |

An agent may edit a merged record only to fix a broken link, and to add `superseded-by` and its
note. The newer record's `supersedes` names each older one, and `ura check` reports a `supersedes`
without the matching `superseded-by`, and the reverse.

## Spec (`spec.md`)

| Field / section         | Type           | Meaning                                                                 | Change |
| ----------------------- | -------------- | ----------------------------------------------------------------------- | ------ |
| `## Replaced behaviour` | list, optional | each behaviour the spec replaces, in bold, with the tests that guard it | New    |

The section sits between `## User stories` and `## Architecture`, and is left out when nothing is
replaced. The spec's approval covers removing or rewriting the tests it names.

## Ruling (`rulings.md`)

| Field                       | Type           | Meaning                           | Change  |
| --------------------------- | -------------- | --------------------------------- | ------- |
| **Decision**                | text           | what was decided                  |         |
| **Rationale**               | text           | why, with links                   |         |
| **Where**                   | text           | the task, or the file             |         |
| **Alternatives considered** | text, optional | what else was weighed             | Changed |
| **If wrong**                | text, optional | what it costs, and how to undo it | Changed |

## Pull request body

| Part              | Meaning                                                                      | Change  |
| ----------------- | ---------------------------------------------------------------------------- | ------- |
| opening block     | "Pull request to review, about N minutes", with the points needing attention | Changed |
| the record's text | the record, with its links made absolute at the finishing commit             | Changed |
| one screenshot    | one per new view, kept by the forge, never committed                         | New     |

The size table, the lists of tests changed, and the rulings section leave the body: what a later
agent needs sits in the record.
