# Discovery, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

## Summary

Reader "observations" are structured descriptions of a book that patrons choose from fixed lists:
its pace, its genres, whether it is fiction. Products that collect them pair a fixed catalog of
attributes with each reader's latest answers per book, and show aggregates of those answers.

The proposal asks [`openlibrary/core/observations.py`](/openlibrary/core/observations.py) for four
things. It wants a catalog of observation types with integer ids and their value names. It wants a
lookup from a stored type id and value id back to their names. It wants the storage of a patron's
observations for a work, replaced by each new submission, and a reader for them. It also wants a
helper that orders value names by a display-order list of value ids.

Today the module has none of this. It forwards submissions to an outside service, TheBestBookOn
(TBBO), and reads the catalog from it. That service's catalog endpoint now answers "Not Found", so
the beta-only form that uses it cannot load. The requirements pin a few catalog entries, and nothing
else of the catalog: its other types, descriptions, and value ids are a gap.

## How other products do it

### The StoryGraph

- After a book, readers answer a fixed set of questions: mood, multiple choice; pace, single choice
  among slow, medium, fast; plot- or character-driven, with "a mix"; and four yes, no, or "it's
  complicated" questions on characters
  ([First Line Reader, 2024](https://firstlinereader.blog/2024/04/08/do-i-agree-with-storygraph-reviewers-opinions-on-storygraphs-review-method/)).
- A book page shows each answer's share of reviewers, "Based on 18,279 reviews"; mood shares do not
  add up to 100%, since readers pick several (same source).
- Its own mood tags, used for recommendations and stats, do not come from the readers' answers (same
  source).
- The answers feed each reader's own stats, such as how many of their books were medium-paced
  ([An Historian About Town](https://anhistorianabouttown.com/storygraph-review-is-it-worth-it/)).
  Plot and character questions do not fit nonfiction (same source).
- Its discovery filters are mood, pace, fiction or nonfiction, and genres
  ([search result summary only](#not-checked), from
  [thestorygraph.com](https://thestorygraph.com/)).

### Goodreads

- Genres on a book page are not chosen from a list: they are "derived from crowd-sourcing of
  shelves", free-form shelf names readers give their books
  ([Goodreads Librarians Group](https://www.goodreads.com/topic/show/1138393-how-do-we-correct-genre-definitions)).
- Synonym shelves are "linked as having the same definition", like "SF" and "scifi" (same source).
- Nobody can edit a book's genres; only the genre structure is maintained by staff (same source).

### LibraryThing

- Tags are free-form, per member, and become site-wide discovery tools; a work page shows what other
  members tagged it ([search result summary only](#not-checked) of
  [HelpThing:Tag](https://wiki.librarything.com/index.php/HelpThing:Tag), which answered 403).

### What they have in common

- **A fixed catalog of attributes, or free tags**: The StoryGraph uses a fixed catalog with single-
  and multiple-choice questions, like the proposal. Goodreads and LibraryThing use free tags, and
  then have to link synonyms.
- **Every attribute optional**, each answer replaced when the reader answers again (the proposal's
  persistence rule).
- **Aggregates per book**, as shares of readers. The proposal does not ask for them; the form's text
  promises a "Reader Observations" section.
- **Per-reader stats** from their own answers. Not asked either.

## Standards and libraries

### web.py 0.62

- The project pins `web.py==0.62` ([`requirements_common.txt`](/requirements_common.txt)).
- `insert` "Inserts `values` into `tablename`"; `multiple_insert` takes "a list of dictionaries, one
  for each row ... each with the same set of keys"; `delete` takes a `where` with `$name`
  placeholders filled from `vars`; `transaction` "Start a transaction"
  ([web.py API docs](https://webpy.org/docs/0.3/api)).
- The docs do not say what `query` returns. A `Storage` is "like a dictionary except `obj.foo` can
  be used in addition to `obj['foo']`" (same source). Rows are `Storage` objects, as
  [checked](#worth-it-and-feasibility).

### PostgreSQL

- An unknown-type literal stored into a column is "fed to the input conversion routine for the
  target type" ([Value Storage](https://www.postgresql.org/docs/current/typeconv-query.html)):
  `'123'` stores into an integer column, `'OL123W'` fails.
- `ON CONFLICT DO NOTHING` "simply avoids inserting a row"
  ([INSERT](https://www.postgresql.org/docs/current/sql-insert.html)). web.py has no helper for it,
  so the diff the proposal describes avoids it.

### Python

- A `namedtuple` subclass has "fields accessible by attribute lookup as well as being indexable and
  iterable", and unpacks like a tuple
  ([collections](https://docs.python.org/3/library/collections.html#collections.namedtuple)).

## The code

### Important reads

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): 27 lines.
  `post_observation` forwards the form's JSON to `TBBO_URL + '/api/observations'` with the patron's
  S3 keys. `get_aspects` reads `TBBO_URL + '/api/aspects'`, cached in memcache for
  `tbbo_aspect_cache_duration` seconds. No database access, no catalog, no ids.
- [`conf/openlibrary.yml`](/conf/openlibrary.yml): `tbbo_url: https://thebestbookon.com` and
  `tbbo_aspect_cache_duration: 86400`.
- [`openlibrary/plugins/openlibrary/api.py`](/openlibrary/plugins/openlibrary/api.py): the
  `observations` page (`POST /observations`) and the `aspects` page (`GET /aspects`) call the two
  functions above. They are the module's only callers.
- [`openlibrary/plugins/openlibrary/js/patron-metadata/index.js`](/openlibrary/plugins/openlibrary/js/patron-metadata/index.js):
  builds the form from `data.aspects`, reading `aspect.label`, `aspect.description`,
  `aspect.multi_choice`, and `aspect.schema.values`. It posts
  `{username, work_id, edition_id?, observations: [{label: value}, ...]}`. `work_id` there is the
  work's OLID, like `OL123W`. It posts nothing when no box is checked.
- [`openlibrary/macros/UserMetadata.html`](/openlibrary/macros/UserMetadata.html): the "My book
  notes" modal, holding the notes form and the empty observations form. It tells patrons the
  observations are anonymous and "will be used to populate the 'Reader Observations' section".
- [`openlibrary/templates/lists/widget.html`](/openlibrary/templates/lists/widget.html), line 286:
  the modal only renders for `ctx.user.is_beta_tester()`.
- [`openlibrary/core/booknotes.py`](/openlibrary/core/booknotes.py) and
  [`openlibrary/core/ratings.py`](/openlibrary/core/ratings.py): the pattern for patron data per
  work. A class of `@classmethod`s, each calling `db.get_db()` and web.py's `query`, `insert`,
  `update`, `delete` with `$name` variables. `Booknotes.get_patron_booknotes` returns
  `list(oldb.query(...))`.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): the `ratings`, `booknotes`, and
  `bookshelves_books` tables. Each has `username text`, `work_id integer`, `created` and `updated`
  timestamps defaulting to UTC now, and a composite primary key. It runs only on a fresh database,
  from [`docker/ol-db-init.sh`](/docker/ol-db-init.sh).
  [`scripts/migrate_db.py`](/scripts/migrate_db.py) migrates only the infobase tables, last changed
  in 2010. The `booknotes` table came in commit `0d8b77580` with a schema.sql change only.
- [`openlibrary/plugins/openlibrary/api.py`](/openlibrary/plugins/openlibrary/api.py), the
  `booknotes` page: its path is `/works/OL(\d+)W/notes`, so `work_id` reaches `Booknotes.add` as a
  numeric string like `"123"`. [`models.Work.get_users_notes`](/openlibrary/core/models.py) passes
  `extract_numeric_id_from_olid(self.key)`, also a numeric string.
- [`openlibrary/tests/core/test_ratings.py`](/openlibrary/tests/core/test_ratings.py): an empty
  test. No core test uses a database.
  [`openlibrary/plugins/upstream/tests/test_merge_authors.py`](/openlibrary/plugins/upstream/tests/test_merge_authors.py)
  sets `web.config.db_parameters = dict(dbn="sqlite", db=":memory:")`, a pattern tests can reuse.
- Commit `5b133cfe8` (2020-10-11), "Update submission form with actual aspects", hard-coded the form
  with "all aspects chosen to date". Its template is in git history only:
  `git show 5b133cfe8:openlibrary/macros/UserMetadata.html`. See
  [the 2020 catalog](#the-2020-catalog-in-git-history).

### The 2020 catalog in git history

The hard-coded form of commit `5b133cfe8` lists 13 types, in this order. Numbering them from 1 gives
`pace` 1, `genres` 10, and `fictionality` 11:

| #   | Name in the form | Question shown                                                         | Kind     | Values                                                       |
| --- | ---------------- | ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| 1   | `pace`           | What is the pace of this book?                                         | radio    | slow, medium, fast                                           |
| 2   | `entertain`      | How entertaining is this book?                                         | radio    | N/A, boring, average, entertaining, very entertaining        |
| 3   | `clarity`        | How clearly is this book written?                                      | radio    | N/A and 5 from incomprehensible to very clear                |
| 4   | `jargon`         | How much notation and technical jargon is used?                        | radio    | N/A and 4 from not technical to highly technical             |
| 5   | `originality`    | Does this book bring anything new to the table?                        | radio    | N/A, rather unoriginal, very original, genre-defining        |
| 6   | `difficulty`     | How challenging or advanced is the subject matter of this book?        | radio    | N/A and 5 from no prior knowledge to domain expertise        |
| 7   | `usefulness`     | How impactful is the content of this book?                             | radio    | N/A, not useful, somewhat useful, very useful, indispensable |
| 8   | `coverage`       | How much depth or breadth does this book cover?                        | radio    | N/A, meandering, wide, narrow                                |
| 9   | `objectivity`    | Are there causes to question the objectivity or accuracy of this book? | checkbox | N/A, biased, misleading, inaccurate, and 3 more              |
| 10  | `genres`         | What are the genres of this book?                                      | checkbox | 24, from biographical to sci-fi; mystery is the 18th         |
| 11  | `fictionality`   | Is this book a work of fact or fiction?                                | radio    | nonfiction, fiction                                          |
| 12  | `audience`       | What are the intended age groups for this book?                        | checkbox | 7, from general audiences to experts                         |
| 13  | `mood`           | What are the moods of this book?                                       | checkbox | 26, from cheerful to scientific                              |

Two pinned requirements differ from it. Fictionality gains `biography` as a third value. Mystery is
value id 7 of genres, but the 18th in the form: value ids do not follow the display order. That is
what the ordering helper's display-order list is for. The ids of the other values cannot be derived
from anything in the repository.

### The proposal's path and existing actions

- **Reading the catalog**: no caller today besides the tests the proposal implies. The beta form
  reads `/aspects`, whose upstream answers `{"detail":"Not Found"}` (checked with `curl` on
  2026-10-19). Its `fail` handler is a `TODO`, so the "My book notes" link does nothing.
- **Submitting observations**: the form posts labels and value names, as the proposal's
  `persist_observations` takes them. It goes to TBBO today, never to the database.
- **Changing an earlier answer**: with persistence, the latest submission replaces the stored set
  for that work. Values not resubmitted are removed, as the proposal requires.
- **Unchecking everything**: the form does not post an empty submission today. Called directly, an
  empty list leaves the stored set empty, by the proposal's rule.
- **Deleting a patron's account**: nothing removes their `booknotes` or `ratings` rows today
  (searched for every caller of `Booknotes.remove` and `Ratings.remove`). Observations would follow
  the same gap. This is outside the feature: noted in the inbox.
- **Other features in flight**: none. The only branches are `main` and this one.

### Rules and their owners

- **Which catalog entries exist**: owned by TBBO today, nowhere in the repository. With the feature,
  the module's catalog owns it.
- **Single choice versus multiple choice**: owned by `multi_choice` in the catalog, enforced only by
  the form's radio buttons. Nothing on the server checks it today.
- **How a work is identified in patron tables**: the numeric part of its OLID, in an integer column,
  in `ratings`, `booknotes`, and `bookshelves_books`.

### Likely changes

- [`openlibrary/core/observations.py`](/openlibrary/core/observations.py): the catalog, the four
  functions, and the `Observations` class, under every option.
- [`openlibrary/core/schema.sql`](/openlibrary/core/schema.sql): a new table for stored
  observations, under every option.
- A new test file, `openlibrary/tests/core/test_observations.py`, under every option.
- [`openlibrary/plugins/openlibrary/api.py`](/openlibrary/plugins/openlibrary/api.py),
  [`index.js`](/openlibrary/plugins/openlibrary/js/patron-metadata/index.js), and
  [`conf/openlibrary.yml`](/conf/openlibrary.yml): only with options B or C of
  [scope](#scope-module-only-or-also-the-form).
- `specs/decisions/`: with option A of [catalog ids](#catalog-ids-over-time), and of
  [code-quality limits](#code-quality-limits).

## The proposal

### The catalog beyond the pinned entries

The requirements pin `pace` (type 1, values slow, medium, fast, single choice), `fictionality`
(nonfiction, fiction, biography), and `genres` (type 10, value 7 is mystery). They require a
non-empty list with a `description` for each entry. They say nothing of the other types, of any
description's text, or of the other value ids. Type id 10 means at least ten types, or ids with
gaps. [The 2020 catalog](#the-2020-catalog-in-git-history) fits the pinned type ids, not the pinned
value ids.

### What "work_id, a string" holds

The interface types `work_id` as a string. The form posts an OLID like `OL123W`. The other patron
tables store the numeric part in an integer column, passed in as a numeric string like `"123"`.
PostgreSQL turns a quoted `'123'` into an integer for an integer column, but rejects `'OL123W'`
([PostgreSQL](#postgresql)).

### Submissions the catalog does not know

A label or value name that is not in the catalog has no ids to store. The proposal does not say
whether it is an error or is skipped.

### Several values for a single-choice type

The proposal's rule, "the stored set equals the submitted set", stores two paces if two are
submitted. Only the form's radio buttons prevent it.

### What the form and endpoints become

The proposal names the module only. The `/aspects` and `/observations` endpoints and the form still
point at TBBO. The catalog accessor's shape, `{observations: [{..., values: [names]}]}`, differs
from what the form reads, `{aspects: [{..., schema: {values}}]}`.

### Where `edition_id` goes

The form posts an `edition_id` when the page shows an edition. The required row keys,
`observation_type`, `observation_value`, `username`, `work_id`, leave it out.

## Worth it and feasibility

The cost is small: one module of about 150 lines, one table, and tests. Its gain is the storage the
beta form has never had, with TBBO's catalog gone. The pinned values constrain the catalog's ids for
good: once rows are stored, a renumbered id silently changes what patrons said.

Outside behaviour it relies on, each checked on 2026-10-19 with web.py 0.62 and an in-memory SQLite
database, outside the repository:

- `db.multiple_insert` and `db.delete(where=..., vars=...)` inside `with db.transaction():` insert
  and remove the expected rows.
- `db.query("SELECT observation_type AS type, observation_value AS value ...")` returns `Storage`
  rows: `row['type']` and `row.type` both work, as `get_patron_observations` requires.
- A `collections.namedtuple('ObservationKeyValue', ['key', 'value'])` gives `.key`, `.value`, and
  unpacks as `(key, value)`, as `get_key_value_pair` requires.

Unverified: the same calls against PostgreSQL, which the project runs in production. web.py builds
the same SQL for both, but the plan's first test should run on the project's database in docker.

No guard is relaxed. The functions take a username from their caller and trust it, as `Booknotes`
does: the endpoint must check the logged-in patron, which is out of scope with option A of
[scope](#scope-module-only-or-also-the-form).

## Approaches

Criteria come from the [proposal](proposal.md), the [constitution](../CONSTITUTION.md) (do not go
beyond the task; keep every named interface; tests for every acceptance scenario; follow the
repository's patterns), and the repository's patterns read above. No decision is active.

### Scope: module only, or also the form

Whether the feature stops at the module, or also moves the beta form and its endpoints off TBBO.
Relies on [what the form and endpoints become](#what-the-form-and-endpoints-become).

| Option                                                                                | Within the proposal | Beta form works after | Work           |
| ------------------------------------------------------------------------------------- | ------------------- | --------------------- | -------------- |
| A. The module, the table, and tests; endpoints and form untouched                     | yes                 | no, as today          | smallest       |
| B. A, plus `/aspects` and `/observations` use the module, and the form reads `values` | goes beyond         | yes                   | + endpoint, JS |
| C. B, plus removing `post_observation`, `get_aspects`, and the TBBO settings          | goes beyond         | yes                   | + removals     |

### Catalog content

Which types, descriptions, value names, and ids the catalog holds beyond the pinned ones. Relies on
[the catalog beyond the pinned entries](#the-catalog-beyond-the-pinned-entries).

| Option                                                                                         | Meets the pins   | Who writes it                   | Matches the 2020 form |
| ---------------------------------------------------------------------------------------------- | ---------------- | ------------------------------- | --------------------- |
| A. The 13 types of the 2020 form, ids 1 to 13, value ids assigned by the agent around the pins | yes              | the agent, reviewed in the spec | yes, minus N/A        |
| B. A catalog the human supplies, such as an export of TBBO's                                   | if it holds them | the human                       | unknown               |
| C. Only the pinned types, `pace` 1, `genres` 10, `fictionality` 11                             | yes, with gaps   | the agent                       | partly                |

### Catalog ids over time

Whether the permanence of type and value ids becomes a project decision, since stored rows hold only
ids.

| Option                                            | Protects stored data   | Cost              |
| ------------------------------------------------- | ---------------------- | ----------------- |
| A. A decision: ids are never renumbered or reused | yes, checked by review | one decision file |
| B. A comment above the catalog only               | only if read           | none              |

### Code-quality limits

The project has no `specs/decisions/code-quality.md`. The repository's [`Makefile`](/Makefile) runs
flake8 with `--max-complexity=10` as a warning only, and
[`scripts/flake8-diff.sh`](/scripts/flake8-diff.sh) checks changed lines at 88 characters.

| Option                                                                 | New tools | Enforced                    |
| ---------------------------------------------------------------------- | --------- | --------------------------- |
| A. A decision recording today's flake8 limits for new and changed code | none      | `make lint-diff`, by review |
| B. A decision saying the project has no limits, revisited in a year    | none      | nothing                     |
| C. A decision adding Ruff with function-length and parameter limits    | Ruff      | CI                          |

### Needs no choice

- **Ordering helper**: fully specified by the proposal. A dictionary from id to name, read in the
  order list's order, absorbs unknown ids and leaves out unlisted values.
- **Label lookup**: a namedtuple, [checked](#worth-it-and-feasibility).
- **Patron records**: `SELECT observation_type AS type, observation_value AS value`, as
  [checked](#worth-it-and-feasibility).
- **Replacing a submission**: the proposal specifies a diff, inserting the missing and deleting the
  absent, in one transaction.
- **Where the catalog lives**: a Python constant in the module. `get_observations` and
  `get_key_value_pair` then need no database, unlike a catalog table.
- **Aggregates per work and per-patron stats**: what other products show, and what the form's text
  promises. Outside the proposal; the questions' scope leaves them out.
- **Translations**: the catalog's names are identifiers stored by the form. Translating what the
  form shows is the form's concern, outside the module.

## Not checked

- LibraryThing's [HelpThing:Tag](https://wiki.librarything.com/index.php/HelpThing:Tag) answered
  403: its facts come from a search result summary.
- The StoryGraph has no public help page found on its review questions; its facts come from two
  reader blogs, and its filters from a search result summary.

- TBBO's catalog: `https://thebestbookon.com/api/aspects` answers `{"detail":"Not Found"}`. Its ids
  and descriptions could not be read.
- The feature's own upstream implementation, deliberately: the proposal forbids looking up existing
  solutions.
