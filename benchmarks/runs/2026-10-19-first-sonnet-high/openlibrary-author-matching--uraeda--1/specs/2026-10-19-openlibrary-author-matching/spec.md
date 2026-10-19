---
status: approved
revision: 1
clarifications: 1
risk-tier: low
plan-review: false
---

# Spec: Match authors on alternate names and surname with birth and death dates

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve an import that looks for an existing author by name, then by alternate name, then by
>   surname, with dates, case-insensitively.
> - Production case-insensitivity is not verified: the vendored query operator is case-sensitive
>   `LIKE`. The first plan task checks how queries reach PostgreSQL. If they do, tests pass but the
>   live site matches only exact casing.
> - An import missing a birth or death date now matches a dated author by name alone. Today that
>   candidate is skipped. I read your answer and the proposal's name-only fallback this way.
> - The surname search can merge two different people who share a last word and both years. Both
>   years must match exactly, which keeps it rare.
> - No decision is created or changed, the risk tier is low, and the plan does not wait for your
>   review.

When a book is imported, [`find_entity`](/openlibrary/catalog/add_book/load_book.py) looks for an
existing author before creating one. Today it searches by exact name, so duplicate authors appear
and works link to the wrong author. This feature adds two fallbacks, alternate names and surname,
each guarded by birth and death dates, and makes the search case-insensitive with `*` wildcards. It
serves contributors who import data and readers who search the catalog. See the
[proposal](proposal.md), the [discovery](discovery-01.md), and the [answers](clarifications-01.md).

## Decisions

None. No answer outlives this feature, so the spec creates, changes, and removes no decision.

Relied on: no active decision applies. The [constitution](../CONSTITUTION.md) is checked below.

## User stories

### US1: Find the author by name, with dates (P1)

An import names an author. The search ignores case, and a `*` in the name matches any characters.
When both dates are given, an exact year match on both outranks other matches. When either date is
missing, the name alone decides.

Why this priority: the other searches only run when this one finds nothing, so it is the base.

Key scenarios:

1. **Given** author OL1A "Jane Austen" born 1775 and died 1817, **When** an import names "jane
   austen" with birth_date 1775 and death_date 1817, **Then** OL1A is returned.
2. **Given** OL3A "John Smith" born 1950 and died "20", and OL7A "John Smith" born 1950 and died
   2010, **When** an import names "John Smith" with birth_date 1950 and death_date 2010, **Then**
   OL7A is returned, not the lower key OL3A.
3. **Given** OL1A "Jane Austen" born 1775 and died 1817, **When** an import names "Jane Austen" with
   no dates, **Then** OL1A is returned.
4. **Given** OL10A "John Smith" and OL2A "John Doe", **When** an import names "John\*" with no
   dates, **Then** OL2A is returned, the lowest numeric key.

More scenarios:

1. **Given** OL2A "John Doe", **When** an import names "Zed\*" with no dates, **Then** nothing is
   found and the import keeps the candidate name "Zed\*".
2. **Given** OL1A "John Smith" born 1900 and died 1980, **When** an import names "Smith, John" with
   birth_date 1900 and death_date 1980, **Then** OL1A is returned through the flipped name.
3. **Given** OL1A "John Smith" born 1900 and died 1980, **When** an import names "John Smith" with
   birth_date 1950 and death_date 2010, **Then** OL1A is not returned.

### US2: Fall back to alternate names (P2)

When no author matches the name, the import tries the authors that list the name as an alternate
name. Both input dates are required, and the candidate must have both dates with equal years.

Key scenarios:

1. **Given** OL1A "Mark Twain" with alternate name "Samuel Clemens", born 1835 and died 1910,
   **When** an import names "samuel clemens" with birth_date 1835 and death_date 1910, **Then** OL1A
   is returned.
2. **Given** OL2A "Sam Clemens" born 1900 and died 1950, and OL1A as above, **When** an import names
   "Sam Clemens" with birth_date 1835 and death_date 1910, **Then** OL1A is not returned, as the
   alternate name "Sam Clemens" is not listed.
3. **Given** OL1A as above, **When** an import names "Samuel Clemens" with only birth_date 1835,
   **Then** OL1A is not returned and the import keeps its own candidate.

More scenarios:

1. **Given** OL1A as above but died 1911, **When** an import names "Samuel Clemens" with birth_date
   1835 and death_date 1910, **Then** OL1A is not returned.
2. **Given** OL4A "Mark Twain" with alternate name "Samuel Clemens" and no dates, **When** an import
   names "Samuel Clemens" with birth_date 1835 and death_date 1910, **Then** OL4A is not returned.
3. **Given** OL2A "Samuel Clemens" born 1900 and died 1950, and OL1A as above, **When** an import
   names "Samuel Clemens" with birth_date 1835 and death_date 1910, **Then** OL1A is returned: a
   name match with wrong dates falls through to the next search.

### US3: Fall back to the surname (P3)

When neither name nor alternate names match, the import takes the last word of its name as the
surname. It looks for authors whose name ends with that word. Both input dates are required, and the
candidate must have both dates with equal years.

Key scenarios:

1. **Given** OL5A "Ludwig van Beethoven" born 1770 and died 1827, **When** an import names "L. van
   Beethoven" with birth_date 1770 and death_date 1827, **Then** OL5A is returned.
2. **Given** OL5A as above, **When** an import names "L. van Beethoven" with birth_date 1770 and
   death_date 1828, **Then** OL5A is not returned.
3. **Given** OL5A as above, **When** an import names "L. van Beethoven" with only death_date 1827,
   **Then** OL5A is not returned.

More scenarios:

1. **Given** OL6A "Alice Blacksmith" born 1900 and died 1980, **When** an import names "J. Smith"
   with birth_date 1900 and death_date 1980, **Then** OL6A is not returned: the name must end with
   the whole word.
2. **Given** OL5A as above, **When** an import names "Beethoven" with birth_date 1770 and death_date
   1827, **Then** OL5A is not returned: a one-word name skips the surname search.

### US4: The mock database follows ILIKE (P4)

Tests use [`MockSite`](/openlibrary/mocks/mock_infobase.py) in place of the real database. Its `~`
operator now behaves like the proposal's ILIKE: the new method `regex_ilike(pattern, text)` tells
whether the whole text matches the pattern, ignoring case.

Key scenarios:

1. **Given** the pattern "john\*", **When** `regex_ilike` is called with the text "John Smith",
   **Then** it returns true.
2. **Given** the pattern "john", **When** `regex_ilike` is called with the text "John Smith",
   **Then** it returns false, as the whole text must match.
3. **Given** the pattern "a_b", **When** it is called with "A_B" and with "axb", **Then** it returns
   true and false: `_` matches only itself.

More scenarios:

1. **Given** the query `{"key~": "/books/*"}`, **When** `things` runs, **Then** it still returns the
   same keys as before this feature.

## Architecture

The search stays in `load_book.py`. `find_author` takes the import dictionary and returns the
candidates of the first search that finds any. A name match is never mixed with a weaker one.
`find_entity` delegates to it and picks one candidate, or `None`. All three searches use the `~`
operator, which the mock makes case-insensitive (see
[the query operator](discovery-01.md#the-query-operator-in-the-vendored-infobase)).

- **The candidate search** (`find_author`) runs the name search with the flipped name, then the
  alternate-names search, then the surname search. It owns the order and the `*` and surname
  patterns. It also owns the rule that the last two searches need both input dates, and the redirect
  walk for every search.
- **The pick** (`find_entity`, with `pick_from_matches`) returns one existing record, the lowest
  numeric key when equal. It owns the preference for an exact year match on both dates, and the
  unchanged branch for organisations.
- **The strict year rule** is a new function in
  [`catalog/utils`](/openlibrary/catalog/utils/__init__.py) next to `author_dates_match`. It tells
  whether both records have both dates with equal years. It owns what "exact year" means for the two
  new searches and the pick, using the year pattern already there.
- **The mock pattern match** (`MockSite.regex_ilike`) tells whether a whole text matches a pattern.
  It owns the mock's `*`, `_`, and case rules, and `filter_index` calls it for `~`.

Tradeoffs:

- The name search stays more permissive than the other two: it keeps today's date filter when both
  dates are given.
- The surname is derived from the name, not stored, so a particle name such as "Van Gogh" gives
  "Gogh".
- Case-insensitivity in production depends on the infogami operator, which this repository does not
  own.

## Edge cases

| Importance | Situation                                             | What happens                                                            |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| High       | Two different people share a last word and both years | the surname search merges them: the only guard is the two exact years   |
| High       | Nothing matches                                       | `find_entity` returns `None`; the import keeps name and dates unchanged |
| Normal     | An input date has no four-digit year, such as "c. 20" | it never counts as an exact year match                                  |
| Normal     | A search reaches a redirected author                  | the redirect is followed, and the target is the candidate               |
| Normal     | The same author is found by two spellings, or twice   | it is one candidate                                                     |
| Normal     | The input name has one word                           | the surname search is skipped, as it repeats the name search            |
| Normal     | The input name has `_`, or a `*` in the middle        | `_` matches itself, and `*` matches any characters                      |
| Niche      | The entity type is not a person                       | the first name match is returned, with no date check, as today          |

## Success criteria

- **SC-001** (one home): The exact year rule is written once, and the two new searches and the pick
  use it.
- **SC-002** (all scenarios): Each scenario above has a test that passes against `MockSite`.
- **SC-003** (no regression): The existing tests of `test_add_book.py`, `test_load_book.py`, and
  `test_mock_infobase.py` pass unchanged.
- **SC-004** (same query): Every existing `key~` query returns the same keys as before.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. You chose the last word of the name as the surname, both dates with equal years on
the two new searches, and a `_` that matches itself. You accepted that production case-insensitivity
depends on the infogami operator. Settled while writing this spec:

- **Missing date**: when either input date is missing, the name search drops the date filter and
  matches by name alone, as the proposal's requirement and your answer say. A dated candidate can
  then match an undated import.
- **Surname query**: the pattern is "\* " plus the surname, so the candidate's name ends with the
  whole word. "Blacksmith" does not match "Smith".
- **Flipped name**: only the name search tries the flipped name. Alternate names use the input name
  as given.
- **Input with only `date`**: it is treated as a missing date, so the name search matches by name
  alone.
- **One-word names**: they skip the surname search.
- **No data change**: no field is added to the author type or the import dictionary.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Low**: no data format change, no new table, and no new interface beyond the mock's method.
