---
kind: feature
finished: 2026-10-19
---

# Record: Match authors on alternate names and surname with birth and death dates

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19; no pull request could be opened from this environment, so the branch
> `2026-10-19-openlibrary-author-matching` was pushed for review. Its full files are in git:
> `git log -- specs/2026-10-19-openlibrary-author-matching/`.

## What and why

When a book is imported, each author is linked to an existing Open Library author or created as a
new one. The lookup compared the exact name only, so a change of case, a variant name, or a name
with initials created duplicate authors, merged later by hand. Imports now try the name, then stored
alternate names, then the surname, ignoring case, with birth and death years telling same-name
people apart, so catalogue users see fewer duplicate and wrongly credited authors.

## Behaviour

- An import with both dates, for a person, takes the first of four steps that finds a candidate: the
  name (and "Surname, Forename" flipped) with both years equal; the same names with the tolerant
  `author_dates_match` rule on a candidate with a birth date, so a missing stored death date passes
  and is then filled in; the name among stored `alternate_names` with both years equal; the surname
  with both years equal. Years are the first four-digit year of each date.
- An import missing a date, or an organization, matches on the name alone: an existing author is
  returned whatever its dates, those with the import's given year first. Organizations do not use
  the flipped name. An empty `entity_type` is a person.
- A same-name author without dates never matches an import with both dates; a dateless candidate
  never matches by alternate name or surname.
- The surname is the text before the first ", " of the import's `name`, else its last word, and
  matches stored names ending with a space and that surname.
- Ties go to the lowest numeric key, OL2A before OL10A. `*` in a name is a wildcard; with no match,
  the new author keeps the name with its `*`, and the import's dates unchanged.
- An empty or `None` date counts as absent. Matching is case-insensitive in the test mock; in
  production it stays a case-sensitive `LIKE` until infogami does `ILIKE`.

## Design

[`find_author(author)`](/openlibrary/catalog/add_book/load_book.py) owns the matching rules: it
queries through infogami's `~` operator, runs each query only when its step is reached (at most five
per imported person), follows redirects, keeps each author once, and returns the candidates best
first. `find_entity(author)` returns its first candidate or `None`; `import_author` keeps the
death-date fill-in and the new-candidate path. Private helpers own the exact-year rule
(`_years_match_exactly`) and the surname (`_get_surname`); `pick_from_matches` was removed.

[`MockSite.regex_ilike(pattern, text)`](/openlibrary/mocks/mock_infobase.py) owns the mock's `~`:
the whole text must fit the pattern, ignoring case, after every `_` is removed, with `*` as any run
and every other character literal. Every `~` query of the code ends with `*`, so existing prefix
queries keep their results. Infogami was not changed: it still matches `_` literally and
case-sensitively, so a name holding `_` is found in production but not in the tests.

Queries keep infogami's default limit, 20 rows, unsorted: a wildcard name, or a common surname, can
miss the right author in production.

## Questions

### Round 01

#### Q1: How does matching become case-insensitive in production?

**Answer:** A: use infogami's `~`, make the mock's `~` case-insensitive, leave infogami unchanged,
and note the production gap in the inbox; "proposal only says case-insensitive matching with the
mock replicating ILIKE".

#### Q2: When several lookups find candidates, which one wins?

**Answer:** A: the name with both years exact, then the name with compatible dates as before, then
alternate names, then the surname, both with both years exact; "proposal says name first, then
alternate_names, then surname".

#### Q3: Can an alternate-name match link to an author who has no dates?

**Answer:** A: the candidate must have both years, equal to the import's; "proposal says
alternate_names needs both dates matching".

#### Q4: How is the surname found, and what does it match?

**Answer:** A: the text before the first ", " of the name, else its last word, against stored names
ending with a space and that surname, with both years equal.

#### Q5: Should the project record its code-quality limits as a decision?

**Answer:** A at first; the spec review then asked to drop the decision, and none was made.

## Changes after approval

- The mock's `~` removes every `_` from a pattern before matching, as the proposal says, instead of
  reading `_` as a literal underscore: asked in the first spec review, before approval.
- The final review kept infogami's default query limit, as the clarifications settled, and flagged
  that it can hide the right author from the surname step in production.

## Follow-ups

- Production's `~` is a case-sensitive `LIKE`; the surname lookup's leading `*` has no index.
- An unused `seen` argument of `_walk_redirects`, and `_query_authors`' docstring saying "ignoring
  case", true in the mock only.
- Integer dates raise `TypeError`, as before.
- Missing tests: an organization with a comma or dates, a surname inside a longer name
  ("Fitzbrewer"), and an alternate-name candidate with a birth year only.
