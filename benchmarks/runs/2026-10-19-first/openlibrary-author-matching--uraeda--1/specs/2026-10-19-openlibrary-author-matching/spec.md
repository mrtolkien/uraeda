---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Match authors on alternate_names/surname with birth/death date

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve a three-step, case-insensitive author search on import: name, then alternate names,
>   then surname, each with birth and death dates.
> - No new decision: nothing here outlives the feature, so the ledger stays unchanged.
> - Undated imports now attach to a same-named author, even a dated one. This reverses today's rule
>   and may merge two people.
> - The surname step is my reading: the last word of the name, matched at the end of a record's
>   name, with both years equal.
> - Unverified: production `~` search being case-insensitive. The mock is made to behave that way,
>   and the production code is not changed.
> - Risk tier is medium: matching changes which authors imports link to, with no data format change.

When a book is imported, Open Library looks for an existing author to link. Today it searches the
exact name, and misses differently cased names, alternate names, and abbreviated first names. This
spec adds a priority search that finds the right author more often, so imports create fewer
duplicates. It follows the [proposal](proposal.md), the [discovery](discovery-01.md), and the
[answers](clarifications-01.md).

## Decisions

No decision is created, changed, or removed. The search rules are behaviour of this feature, and the
code and tests record them.

Relied on: none. `specs/decisions/` has no active decision that applies.

## User stories

### US1: Find an author by name and dates, ignoring case (P1)

An importer submits an author with a name and, usually, birth and death dates. The search finds the
existing record whatever the casing, and falls back to the name alone when a date is missing.

Why this priority: it is the first step of the priority order, and it also holds the date rules and
wildcards the later steps reuse.

Key scenarios:

1. **Given** the author "John Smith" born 1900, died 1970, **When** an import has name "john smith",
   birth_date "1900", death_date "1970", **Then** the existing record is returned.
2. **Given** "John Smith" (1900–1970) and "John Smith" (1950–2000), **When** an import has name
   "JOHN SMITH", birth_date "1950", death_date "2000", **Then** the second record is returned.
3. **Given** the author "John Smith" born 1900, died 1970, **When** an import has name "john smith"
   and no dates, **Then** the existing record is returned.

More scenarios:

1. **Given** an author "Smith, John", **When** an import has name "John Smith", **Then** the flipped
   name is searched too, and the record is returned.
2. **Given** an import with birth_date "1900" and no death_date, and "John Smith" (1950–2000),
   **Then** the record is returned, because the name alone decides.
3. **Given** two matching records `/authors/OL2A` and `/authors/OL10A`, **When** the import has no
   dates, **Then** `/authors/OL2A` is returned, by numeric key order.
4. **Given** an entity_type of "org", **When** an import's name matches a record, **Then** the first
   match is returned with no date check, as today.

### US2: Find an author by alternate name (P2)

When no record has the imported name, the search tries each record's `alternate_names`. This needs
both dates in the import, and both years must equal the record's.

Key scenarios:

1. **Given** the author "Samuel Clemens" with alternate_names ["Mark Twain"], born 1835, died 1910,
   **When** an import has name "mark twain", birth_date "1835", death_date "1910", **Then** that
   record is returned.
2. **Given** the same author, **When** an import has name "Mark Twain", birth_date "1835" and
   death_date "1911", **Then** no record is returned.
3. **Given** the same author, **When** an import has name "Mark Twain" and birth_date "1835" only,
   **Then** no record is returned.

### US3: Find an author by surname (P3)

When the name and alternate names find nothing, the search looks for records whose name ends with
the import's surname. Both dates must be in the import and equal the record's years.

Key scenarios:

1. **Given** the author "John Smith" born 1900, died 1970, **When** an import has name "J. Smith",
   birth_date "1900", death_date "1970", **Then** that record is returned.
2. **Given** the same author, **When** an import has name "J. Smith", birth_date "1900", death_date
   "1971", **Then** no record is returned.
3. **Given** the same author, **When** an import has name "J. Smith" and no dates, **Then** no
   record is returned.

### US4: Wildcards and new authors (P3)

A `*` in an import name matches any run of characters. When nothing matches, the import builds a new
author with its fields untouched.

Key scenarios:

1. **Given** authors `/authors/OL9A` "John Smith" and `/authors/OL3A` "Johnny Cash", **When** an
   import has name "John*", **Then** `/authors/OL3A` is returned.
2. **Given** no author matches, **When** an import has name "John*", birth_date "1900", death_date
   "1970", **Then** the new author keeps name "John*" and both dates unchanged.

## Architecture

The search stays in [`load_book.py`](/openlibrary/catalog/add_book/load_book.py), where it lives
today. Queries use the `~` operator with `*` wildcards, on the assumption that production does
case-insensitive matching (see [discovery](discovery-01.md#case-insensitivity-depends-on-infogami)).
The mock gets the same behaviour, so tests can run offline.

- **`find_author(author)`** takes the import dictionary and runs the three steps in order, name,
  `alternate_names`, then surname. It returns the candidate records of the first step that finds
  any, with redirects followed. It owns the step order and the rule that the last two steps need
  both dates.
- **`find_entity(author)`** delegates to `find_author`. It returns the existing record, or `None`
  when none matches. It owns the choice among candidates: a record with both years equal first, then
  the lowest key by numeric order.
- **`regex_ilike(pattern, text)`** on the mock site is a new method of `MockSite`, in
  [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py). It returns whether `text` fully matches
  `pattern`, ignoring case, with `*` as any run of characters and `_` ignored. The mock's `~` filter
  calls it.
- **Date rules** stay with the existing `author_dates_match`, which compares years. The search adds
  only that both dates are present where a step requires them.

Tradeoffs:

- Production case-insensitivity is assumed, not enforced here. A case-sensitive production still
  misses differently cased names.
- The mock ignores `_`, while production escapes it as a literal. A test can pass on the mock and
  differ in production for a name with `_`.
- The surname step can link an import to the wrong person who shares a surname and both years.

## Edge cases

| Importance | Situation                                                        | What happens                                                        |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| High       | An import has no dates, and the same-named record has dates      | The record is returned. Only the name is compared.                  |
| High       | An import has both dates, and a name match has a different year  | That record is not returned, and the next steps run.                |
| High       | Alternate-name or surname step, and either import date is absent | The step is skipped, and no record is returned from it.             |
| Normal     | Several records match                                            | The one with both years equal wins, else the lowest numeric key.    |
| Normal     | A match is a redirect                                            | The redirect is followed, and the target record is used.            |
| Normal     | A name has a comma, as "Smith, John"                             | The flipped name "John Smith" is also searched in the name step.    |
| Normal     | No record matches                                                | `find_entity` returns `None`, and the import builds the author.     |
| Niche      | A mock pattern holds `_`                                         | The `_` is ignored when matching.                                   |
| Niche      | An import's name has one word                                    | That word is the surname, and the step searches names ending in it. |

## Success criteria

- **SC-001** (casing): Names that differ only in letter case resolve to the same record.
- **SC-002** (priority): A name match is returned before an alternate-name match, and that before a
  surname match, for the same dates.
- **SC-003** (year gate): An alternate-name or surname match is never returned when either year
  differs, or either import date is missing.
- **SC-004** (mock parity): `regex_ilike` passes tests for case, `*`, `_`, and full-string matching.
- **SC-005** (new author): An unmatched import keeps `name`, `birth_date`, and `death_date`
  unchanged, `*` included.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Your answers changed only these readings: production is assumed to do
case-insensitive search, an undated import matches on the name alone with dates ignored, and the
surname is the last word of the name. Settled while writing this spec:

- **Surname of a flipped name**: for "Smith, John" the surname is "Smith", taken from the comma
  form, so both orders search the same surname.
- **Preference among name matches**: with both dates in the import, a record whose two years are
  equal wins over one that only passes the existing date check.
- **Candidate dates in the later steps**: a record without both dates is not a match for the
  alternate-name and surname steps, since the proposal asks for an exact match.
- **Surname pattern**: the step queries names ending in the surname, as `*<surname>`, without a word
  boundary, so "Smith" can match "Blacksmith". Both years still must be equal.
- **Mock indexing of `alternate_names`**: the plan's first task checks that the mock matches list
  values, and extends `filter_index` if it does not.
- **No data model file**: no stored data or file format changes.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: no data format change, but matching decides which authors imports link to, and an
undated import can now attach to a dated author.
