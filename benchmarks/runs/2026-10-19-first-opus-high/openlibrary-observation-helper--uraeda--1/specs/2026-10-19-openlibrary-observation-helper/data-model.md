# Data model: Observation ordering helper, catalog accessor, label lookup, and persistence

The stored data and file formats that [the spec](spec.md) adds or changes. Internal types are the
plan's.

## observations

A new table in [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql), one row per value a
patron picked for a work. It follows the `ratings` and `booknotes` tables beside it. On a fresh
database `schema.sql` creates it; in production it is created by hand, from the pull request.

| Field               | Type                                           | Meaning                                               | Change |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------- | ------ |
| `work_id`           | `integer NOT NULL`                             | the numeric part of the work's id: `123` for `OL123W` | New    |
| `username`          | `text NOT NULL`                                | the patron who made the observation                   | New    |
| `observation_type`  | `integer NOT NULL`                             | a type id of the catalog below                        | New    |
| `observation_value` | `integer NOT NULL`                             | a value id of that type, in the catalog below         | New    |
| `created`           | `timestamp without time zone`, default UTC now | when the row was inserted                             | New    |

The primary key is (`work_id`, `username`, `observation_type`, `observation_value`): a value is
stored at most once per patron and work. Rows are inserted and deleted, never updated, so the table
has no `updated` column.

## Observation catalog

A constant in [`openlibrary/core/observations.py`](/openlibrary/core/observations.py), not a table.
Its ids are what the rows above store, so they are permanent once released: see
[Observation ids](../decisions/observation-ids.md). The types and descriptions come from the beta
form of 2020 in git history, without its "N/A" values; `biography` is added to fictionality.

Value ids count from 1 in display order, except in genres: `mystery` is pinned at 7, and the other
genres take 1 to 6, then 8 to 24, in display order. Single choice is a radio button in the 2020
form, multiple choice a checkbox.

| Type id | Label           | Description                                                            | Multiple | Values, in display order, with their ids                                                                                                                                                                                                                                                                                    |
| ------- | --------------- | ---------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `pace`          | What is the pace of this book?                                         | no       | slow 1, medium 2, fast 3                                                                                                                                                                                                                                                                                                    |
| 2       | `entertainment` | How entertaining is this book?                                         | no       | boring 1, average 2, entertaining 3, very entertaining 4                                                                                                                                                                                                                                                                    |
| 3       | `clarity`       | How clearly is this book written?                                      | no       | incomprehensible 1, confusing 2, average 3, clear 4, very clear 5                                                                                                                                                                                                                                                           |
| 4       | `jargon`        | How much notation and technical jargon is used?                        | no       | not technical 1, low technicality 2, medium technicality 3, highly technical 4                                                                                                                                                                                                                                              |
| 5       | `originality`   | Does this book bring anything new to the table?                        | no       | rather unoriginal 1, very original 2, genre-defining 3                                                                                                                                                                                                                                                                      |
| 6       | `difficulty`    | How challenging or advanced is the subject matter of this book?        | no       | no prior knowledge required 1, good first book on topic 2, contains some advanced topics 3, very difficult 4, requires domain expertise 5                                                                                                                                                                                   |
| 7       | `usefulness`    | How impactful is the content of this book?                             | no       | not useful 1, somewhat useful 2, very useful 3, indispensable 4                                                                                                                                                                                                                                                             |
| 8       | `coverage`      | How much depth or breadth does this book cover?                        | no       | meandering 1, wide 2, narrow 3                                                                                                                                                                                                                                                                                              |
| 9       | `objectivity`   | Are there causes to question the objectivity or accuracy of this book? | yes      | biased 1, misleading 2, inaccurate 3, typos 4, inflammatory 5, needs citations 6                                                                                                                                                                                                                                            |
| 10      | `genres`        | What are the genres of this book?                                      | yes      | biographical 1, textbook 2, reference 3, technical 4, dictionary 5, encyclopedia 6, how-to 8, romance 9, action 10, anthology 11, classic 12, graphical 13, crime 14, drama 15, fantasy 16, horror 17, humor 18, mystery 7, paranormal 19, memoir 20, poetry 21, satire 22, philosophy 23, sci-fi 24                        |
| 11      | `fictionality`  | Is this book a work of fact or fiction?                                | no       | nonfiction 1, fiction 2, biography 3                                                                                                                                                                                                                                                                                        |
| 12      | `audience`      | What are the intended age groups for this book?                        | yes      | general audiences 1, baby 2, kindergarten 3, elementary 4, high school 5, college 6, experts 7                                                                                                                                                                                                                              |
| 13      | `mood`          | What are the moods of this book?                                       | yes      | cheerful 1, inspiring 2, reflective 3, gloomy 4, humorous 5, melancholy 6, idyllic 7, whimsical 8, romantic 9, mysterious 10, ominous 11, informative 12, calm 13, lighthearted 14, hopeful 15, angry 16, fearful 17, tense 18, lonely 19, dark 20, sad 21, suspenseful 22, strange 23, emotional 24, dry 25, scientific 26 |

Each type holds its values as `{id, name}` entries, and a display-order list of their value ids.
Labels are unique across the catalog, and value names unique within their type: a name like
`average` may appear in two types.
