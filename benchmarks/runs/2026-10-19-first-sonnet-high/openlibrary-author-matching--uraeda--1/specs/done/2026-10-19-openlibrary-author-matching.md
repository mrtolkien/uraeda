---
kind: feature
finished: 2026-10-19
---

# Record: Match authors on alternate names and surname with birth and death dates

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in a pull request on the branch `2026-10-19-openlibrary-author-matching`. Its full
> files are in git: `git log -- specs/2026-10-19-openlibrary-author-matching/`.

## What and why

When a book is imported, `find_entity` looks for an existing author before creating one. It searched
by exact name only, so duplicate authors appeared and works linked to the wrong author. It now also
tries alternate names and the surname, each guarded by birth and death dates, case-insensitively
with `*` wildcards.

## Behaviour

- **Name search**: case-insensitive, `*` is a wildcard, the flipped name ("Smith, John") is tried
  too. With both input dates, today's date filter applies and an exact year match on both dates
  outranks other matches; with either date missing, the name alone decides, even for a dated
  candidate.
- **Alternate names**: only when both input dates are given, and the candidate must have both dates
  with equal four-digit years. Runs only when the name search finds nothing.
- **Surname**: the last word of the input name, matched as a whole word at the end of the
  candidate's name; same date rule; a one-word name skips it.
- **Ties** go to the lowest numeric key. Redirects are followed for every search. Organisations keep
  the exact-name branch with no date check.
- **Mock database**: `MockSite.regex_ilike(pattern, text)` makes the `~` operator a full-string,
  case-insensitive match; `*` is a wildcard and `_` matches itself.

## Design

`find_author(author)` in [`load_book.py`](/openlibrary/catalog/add_book/load_book.py) runs the
searches in order and returns the candidates of the first that finds any; `find_entity` delegates to
it and picks one with `pick_from_matches`. The exact-year rule is
[`author_years_match_exactly`](/openlibrary/catalog/utils/__init__.py), the one home of that rule.
The mock's pattern rules are in [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py).
Production case-insensitivity depends on the infogami `~` operator, which is `LIKE` in the vendored
code, so the live site may still match only exact casing until infogami changes.

## Questions

### Round 01

#### Q1: What is the surname the third search matches on?

**Answer:** A, the last word of the input name.

#### Q2: How must dates match on the `alternate_names` and surname searches?

**Answer:** A: both dates required, exact years match.

#### Q3: How is case-insensitive search done in production?

**Answer:** A: query with `~`, make the mock follow ILIKE, and name the production gap.

#### Q4: Does `_` in a mock pattern mean a literal underscore, or is it removed?

**Answer:** A: a literal underscore.

#### Q5: Should the year rule for the name search stay as it is today?

**Answer:** A: exact year match on both dates takes precedence; name-only fallback when a date is
missing.

## Follow-ups

- Production case-insensitivity needs the infogami `~` operator to use `ILIKE`.
- The surname of a comma name such as "Smith, John" is its last word, "John".
