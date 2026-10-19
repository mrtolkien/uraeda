---
kind: feature
finished: 2026-10-19
---

# Record: Match authors on alternate_names/surname with birth/death date

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in the pull request of branch `2026-10-19-openlibrary-author-matching` (no forge CLI
> was available to open it). Its full files are in git:
> `git log -- specs/2026-10-19-openlibrary-author-matching/`.

## What and why

When a book is imported, Open Library links an existing author or builds a new one. The search only
matched the exact name, so differently cased names, alternate names, and abbreviated first names
created duplicate authors. The search now follows a priority order and ignores case.

## Behaviour

- **Name step**: case-insensitive, `*` is a wildcard, and an import name with a comma is also
  searched flipped. Dates reject a record only when the import has both `birth_date` and
  `death_date` (or a `date`) and they contradict the record's.
- **An undated import** matches a same-named author even when the record has dates. This reverses
  the old rejection and can merge two people.
- **Alternate-name step**, then **surname step** (the last word of the name, matched at the end of a
  record's name): only when the import has both dates, and a record must have both years equal to
  them.
- **Choice**: a record with both years equal wins, else the lowest key in numeric order. A
  non-person `entity_type` returns the first name match with no date check.
- **No match**: `find_entity` returns `None`, and the import builds the author with its fields
  unchanged.
- **Mock**: `~` is a case-insensitive full-string match, `*` is any run of characters, and `_` is
  ignored.

## Design

`find_author(author)` runs the steps and `find_entity` chooses among candidates, in
[`load_book.py`](/openlibrary/catalog/add_book/load_book.py). `MockSite.regex_ilike` in
[`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py) gives the mock the production behaviour.
Production case-insensitivity of `~` is assumed, not verified: the pinned infogami uses a
case-sensitive `LIKE`.

## Questions

### Round 01

#### Q1: How is production search made case-insensitive?

**Answer:** A: query with `~`, assume production does ILIKE, and make the mock behave that way.

#### Q2: What happens when the import has no birth or death date?

**Answer:** A: fall back to case-insensitive name matching alone.

#### Q3: What does the surname search look for?

**Answer:** "Your call, take recommended A".

## Changes after approval

- The flipped-name search applies to an import with a comma only, as the spec's edge case says; its
  first user story scenario said the reverse.
- An import with only a `date` keeps its date check in the name step.
- A surname ending in `*` matches by years alone.

## Follow-ups

- Verify that production `~` is case-insensitive, and that `_` is a literal there.
