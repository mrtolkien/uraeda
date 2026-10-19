---
status: answered
---

# Clarifications, round 01: Observation ordering helper, catalog accessor, label lookup, and persistence

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed: the module is small, and every call it relies on was
>   checked on SQLite. The catalog beyond the pinned entries is the one real gap.
> - The catalog's content and the permanence of its ids last beyond this feature: stored rows hold
>   only ids, so a renumbered id changes what patrons said.
> - The beta "My book notes" form is broken today, since its outside catalog service is gone. The
>   scope question decides whether this feature fixes it.
> - Code-quality limits are asked once for the project, since it has none recorded.
> - Check the settled points on unknown labels, on `work_id`'s format, and on creating the table in
>   production.

## Context

### Goal

The [proposal](proposal.md) asks
[`openlibrary/core/observations.py`](/openlibrary/core/observations.py) for reader observations.
Observations are values patrons pick from fixed lists to describe a work, like its pace or genres.
The module needs a catalog of observation types and values, and a lookup from stored ids to names.
It also stores each patron's latest observations per work. Last, it needs a helper ordering value
names by a display-order list of value ids.

### Today

- The module forwards observations to an outside service, TheBestBookOn, and reads the catalog from
  it. Its catalog endpoint now answers "Not Found".
- The only user is the "My book notes" modal, shown to beta testers
  ([`UserMetadata.html`](/openlibrary/macros/UserMetadata.html),
  [`patron-metadata/index.js`](/openlibrary/plugins/openlibrary/js/patron-metadata/index.js)). It
  cannot load its form, so its link does nothing.
- Nothing is stored in Open Library's database. Ratings and book notes are stored per patron and
  work by [`ratings.py`](/openlibrary/core/ratings.py) and
  [`booknotes.py`](/openlibrary/core/booknotes.py), the pattern to follow.

| Product                                                                                                                               | How readers describe a book                                 | What a book page shows           |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------- |
| [The StoryGraph](https://firstlinereader.blog/2024/04/08/do-i-agree-with-storygraph-reviewers-opinions-on-storygraphs-review-method/) | fixed questions: moods (several), pace (one of 3), and more | each answer's share of reviewers |
| [Goodreads](https://www.goodreads.com/topic/show/1138393-how-do-we-correct-genre-definitions)                                         | free-form shelves                                           | genres derived from shelf counts |
| LibraryThing                                                                                                                          | free-form tags                                              | the tags members gave            |

### Scope

The module's four functions and the `Observations` class, a database table, and tests. Showing
aggregates per work, like The StoryGraph's shares, and per-patron stats are left out: the proposal
does not ask for them. Whether the beta form and its endpoints move off the outside service is the
first question.

### Sources

- The module, its endpoints in [`api.py`](/openlibrary/plugins/openlibrary/api.py), the form, the
  ratings and book notes modules, [`schema.sql`](/openlibrary/core/schema.sql), and the form's 2020
  version in git history.
- The StoryGraph, Goodreads, and LibraryThing pages, the web.py 0.62 and PostgreSQL docs, and
  Python's `namedtuple`.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: Should this feature also move the beta form and its endpoints onto the new module?

The proposal names the module only. Its two callers, `GET /aspects` and `POST /observations` in
[`api.py`](/openlibrary/plugins/openlibrary/api.py), still call the outside service. The beta form
reads `{aspects: [{..., schema: {values}}]}`, a shape that differs from the new accessor's
`{observations: [{..., values}]}`. Moving the form means changing the two endpoints and the form's
script. The constitution says the agent must not go beyond what the task asks
([principle I](../CONSTITUTION.md#i-humans-stay-in-control)). More in
[discovery](discovery-01.md#scope-module-only-or-also-the-form).

Why it matters: with the module only, nothing in the product uses the new storage yet, and the beta
form stays broken. Moving it makes the feature usable, at the cost of work the proposal did not ask
for.

- **A (recommended). Build the module, its table, and its tests only; leave the endpoints, the form,
  and the existing `post_observation` and `get_aspects` functions untouched.**
  - [pro] exactly the proposal, nothing to review beyond it.
  - [con] the beta form stays broken until a later feature moves it.
  - Why recommended: the constitution forbids going beyond the task; moving the form fits a
    follow-up proposal.
- **B. Build the module, and switch `/aspects` and `/observations` to it, with the form reading the
  new shape and the endpoint storing for the logged-in patron.**
  - [pro] beta testers can record observations again.
  - [con] endpoint and script changes the proposal does not ask for, with login checks to get right.
- **C. Do B, and also remove `post_observation`, `get_aspects`, and the outside service's
  settings.**
  - [pro] no dead code left pointing at a gone service.
  - [con] the most work beyond the proposal.

**Answer:** A. The proposal names the module only.

## Q2: What should the catalog hold beyond the entries the proposal pins?

The proposal pins only part of the catalog:

- `pace` is type 1, single choice, with slow, medium, fast; slow is value 1.
- `fictionality` has nonfiction, fiction, biography.
- `genres` is type 10, and its value 7 is mystery.

Every entry also needs a description. Nothing says which other types exist, or which ids the other
values have. The outside service's catalog cannot be read any more.

Git history has a hard-coded form from 2020 with 13 types, in this order: pace, entertainment,
clarity, jargon, originality, difficulty, usefulness, coverage, objectivity, genres, fictionality,
audience, mood. Numbering them from 1 matches the pinned type ids: pace 1, genres 10. Its values do
not match the pinned value ids: mystery is the 18th genre there, not the 7th. Its question texts can
serve as descriptions. Most of its single-choice types start with an "N/A" value. More in
[discovery](discovery-01.md#the-2020-catalog-in-git-history).

Why it matters: stored rows hold only ids, so the ids chosen now cannot change once patrons use the
feature. The list of types is also what patrons will be asked.

- **A (recommended). Use the 13 types of the 2020 form as types 1 to 13, with its questions as
  descriptions. Keep its values minus "N/A", add biography to fictionality, and assign value ids
  around the pinned ones. The spec lists the whole catalog for your review.**
  - [pro] the only source that fits the pinned type ids, and the catalog patrons were already shown.
  - [con] the other value ids are the agent's own, not the outside service's, if it ever had others.
  - Why recommended: it meets every pin, and your review of the spec's catalog table catches any
    wrong entry. "N/A" is dropped because every type is already optional.
- **B. You supply the catalog, such as an export of the outside service's, before the spec is
  written.**
  - [pro] the ids match whatever the outside service used.
  - [con] it waits on you, and the export may not exist any more.
- **C. Hold only the pinned types: pace as 1, genres as 10, fictionality as 11, with gaps between.**
  - [pro] the smallest catalog, nothing invented.
  - [con] genres holds only mystery at id 7 unless values are invented anyway, and the gaps puzzle
    future readers.

**Answer:** Your call; take A.

## Q3: Should the permanence of catalog ids become a project decision?

Stored rows hold a type id and a value id, never names. If an id is later renumbered or reused,
every stored row with it silently changes meaning. A decision is a rule binding all later work, in
`specs/decisions/`, checked by review. More in [discovery](discovery-01.md#catalog-ids-over-time).

Why it matters: a later feature editing the catalog would read this rule before touching it; a code
comment can be missed.

- **A (recommended). Record a decision: observation type and value ids are never renumbered or
  reused, and removing one needs a plan for its stored rows.**
  - [pro] every later feature that edits the catalog sees the rule.
  - [con] one more file to approve with the spec.
  - Why recommended: the cost is one short file, and the damage it prevents cannot be undone.
- **B. Only a comment above the catalog in the code.**
  - [pro] nothing to approve.
  - [con] protects only readers of that file.

**Answer:** Your call; take A.

## Q4: Should the project record code-quality limits?

The project has no recorded code-quality limits, so this is asked once for the whole project. The
[`Makefile`](/Makefile)'s `lint` target runs flake8 with `--max-complexity=10`, as a warning only.
`make lint-diff` checks changed lines at 88 characters
([`scripts/flake8-diff.sh`](/scripts/flake8-diff.sh)). More in
[discovery](discovery-01.md#code-quality-limits).

Why it matters: a recorded limit binds every later feature's code and review.

- **A (recommended). Record a decision with today's flake8 limits for new and changed code:
  complexity 10 and lines of 88 characters, checked by `make lint-diff` and by review.**
  - [pro] no new tool, and today's code already meets it.
  - [con] no limit on function or file length, which flake8 lacks.
  - Why recommended: it states what the repository already checks, without adding a dependency.
- **B. Record a decision saying the project has no limits, to revisit in a year.**
  - [pro] nothing to follow.
  - [con] reviews have no shared limit to point at.
- **C. Record a decision adding Ruff, with limits on function length, parameters, and nesting.**
  - [pro] the most complete checks.
  - [con] a new development dependency, and markers on today's offenders.

**Answer:** Your call; take A.

## Settled without the human

### Check these

- **Unknown labels and values** make `persist_observations` raise a `ValueError` before writing
  anything. Their ids cannot be stored, and a half-applied submission would break the "stored set
  equals submitted set" rule. See
  [discovery](discovery-01.md#submissions-the-catalog-does-not-know).
- **Several values for a single-choice type**, like two paces, are stored as submitted. The
  proposal's rule says the stored set equals the submitted one; the form's radio buttons prevent it.
  See [discovery](discovery-01.md#several-values-for-a-single-choice-type).
- **`work_id`'s format** is the numeric part of the work's id as a string, like `"123"`, stored in
  an integer column. Ratings, book notes, and reading logs all do so. See
  [discovery](discovery-01.md#what-work_id-a-string-holds).
- **`edition_id`** is not stored: the proposal lists the row's keys, and it is not among them. See
  [discovery](discovery-01.md#where-edition_id-goes).
- **Creating the table in production** is a manual `CREATE TABLE`, given in the pull request.
  `schema.sql` only runs on a fresh database, as when book notes came. See
  [discovery](discovery-01.md#important-reads).

### Behaviour

- **An empty submission** removes all of the patron's observations for that work, by the proposal's
  rule.
- **A value submitted twice** is stored once.
- **The catalog accessor** lists types by id, each with its values in display order, using the
  ordering helper.
- **A patron's records** come back ordered by type id, then value id, so callers get a stable order.

### Under the hood

- **The catalog** is a Python constant in the module, so the accessor and the lookup need no
  database. See [discovery](discovery-01.md#needs-no-choice).
- **The lookup's result** is a `namedtuple` with `key` and `value`. See
  [discovery](discovery-01.md#python).
- **Replacing a submission** inserts the missing rows and deletes the absent ones in one
  transaction, as the proposal describes.
- **The table** is named `observations`. Its primary key is work, username, type, and value, with a
  `created` timestamp like the other patron tables.
- **Tests** use an in-memory SQLite database through web.py, as the author-merge tests do.

**Notes:**
