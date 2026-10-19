---
status: answered
---

# Clarifications, round 01: Match authors on alternate names and surname with birth and death dates

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes. Three points of the proposal do not fit the code: no
>   stored surname, a case-sensitive production operator, and an ambiguous date rule.
> - The meaning of "surname" is a gap: authors store none, so the code must derive one.
> - Case-insensitive search in production may need a change to the infogami submodule, which this
>   repository does not own.
> - The date rule for `alternate_names` is worded two ways in the proposal.
> - Settled points to check: the strict year helper and the unchanged organisation branch.

## Context

### Goal

Import should find the right existing author more often. It tries the name, then `alternate_names`,
then the surname, each with birth and death dates. Duplicate authors and wrongly linked works become
rarer, for contributors who import data and readers who search the catalog.

### Today

[`find_entity`](/openlibrary/catalog/add_book/load_book.py) searches by exact name and by the
flipped name ("Smith, John" becomes "John Smith"). It then discards candidates whose dates disagree.
Missing dates pass.

| Piece                    | Today                                                                          | Proposal                                     |
| ------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------- |
| Name search              | Exact, case-sensitive                                                          | Case-insensitive, `*` wildcard               |
| `alternate_names` search | None                                                                           | Needs both dates, exact years                |
| Surname search           | None                                                                           | Needs both dates, exact years                |
| Mock `~` operator        | Case-sensitive prefix match in [the mock](/openlibrary/mocks/mock_infobase.py) | `regex_ilike`: full-string, case-insensitive |

### Scope

Covers `find_author`, `find_entity`, the new `MockSite.regex_ilike`, and their tests. It leaves out
author merging, the search index, and the import of new fields.

### Sources

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py),
  [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py),
  [`author.type`](/openlibrary/plugins/openlibrary/types/author.type), and the vendored
  [`dbstore.py`](/vendor/infogami/infogami/infobase/dbstore.py).
- The full investigation is in [discovery](discovery-01.md). No outside sources were read, because
  the proposal forbids looking up existing solutions.

## Q1: What is the surname the third search matches on?

Author records have no surname field.
[`author.type`](/openlibrary/plugins/openlibrary/types/author.type) holds `name`, `personal_name`,
`alternate_names`, and the dates. The import dictionary has none either. The surname must come from
the name. More in [discovery](discovery-01.md#there-is-no-surname-to-match-on).

Why it matters: it decides which people the third search can merge, and whether the proposal's rule
is implemented as written.

- **A (recommended). Take the last word of the input name as the surname, and match existing authors
  whose name ends with that word, case-insensitively, when both dates match exactly.**
  - [pro] simple, and predictable to explain and test.
  - [con] a particle name such as "Ludwig van Beethoven" gives "Beethoven", and "Van Gogh" gives
    "Gogh".
  - Why recommended: both dates must match exactly, which keeps wrong merges rare.
- **B. Same as A, but keep particles such as "van", "de", and "von" with the last word.**
  - [pro] handles common European surnames better.
  - [con] a list of particles to maintain, which the proposal does not ask for.
- **C. Leave out the surname search.**
  - [pro] no wrong-merge risk from it.
  - [con] drops one of the proposal's three rules.

**Answer:** Your call: A

## Q2: How must dates match on the `alternate_names` and surname searches?

The proposal words the `alternate_names` rule as "exactly match the candidate's values when dates
are available". The surname rule says both dates "must exactly match". Under the first wording, a
candidate with no dates could match. More in
[discovery](discovery-01.md#exact-match-when-dates-are-available-contradicts-requires-both).

Why it matters: it decides whether an undated author can be matched through an alternate name.

- **A (recommended). On both paths the candidate must have a birth date and a death date, and both
  years must equal the input's.**
  - [pro] one rule for both paths, and the lowest chance of a wrong merge.
  - [con] an undated author record is never found through an alternate name.
  - Why recommended: it satisfies the surname rule and the first reading of the other.
- **B. The surname path stays strict, but the `alternate_names` path also accepts a candidate that
  has no dates.**
  - [pro] finds undated authors that list the name as an alternate.
  - [con] two rules to explain, and a weaker guard on the path that matches on a name list.

**Answer:** A: both dates required, exact years match

## Q3: How is case-insensitive search done in production?

The proposal asks for "production ILIKE semantics". The vendored infobase turns the `~` operator
into SQL `LIKE`, which is case-sensitive in PostgreSQL
([dbstore.py](/vendor/infogami/infogami/infobase/dbstore.py)). No `ILIKE` exists in the repository.
`vendor/infogami` is a submodule of another repository. The mock can be made case-insensitive here,
but the real database would still compare case-sensitively. More in
[discovery](discovery-01.md#the-query-operator-in-the-vendored-infobase).

Why it matters: it decides whether the feature works on the live site, or only in tests.

- **A (recommended). Query with `~`, make the mock follow ILIKE as the proposal asks, and note in
  the spec that production case-insensitivity depends on the infogami operator.**
  - [pro] stays within this repository and the proposal's interface.
  - [con] different casings may not match on the live site until infogami changes.
  - Why recommended: the proposal names only the mock method, and the submodule is not ours.
- **B. Also change `dbstore.py` in the infogami submodule to use `ILIKE`.**
  - [pro] the live site becomes case-insensitive.
  - [con] a change in another repository, which affects every `~` query site-wide, such as `key~`.
- **C. Fetch broader results with `~` and compare case-insensitively in Python.**
  - [pro] works on the live site without touching infogami.
  - [con] extra code the proposal does not ask for, and a query that may return many authors.

**Answer:** Your call: A

## Q4: Does `_` in a mock pattern mean a literal underscore, or is it removed?

The proposal says `_` is "ignored in patterns". Production escapes `_` to `\_`, so it matches a
literal underscore and is not the single-character wildcard. "Ignored" can mean "not a wildcard" or
"stripped out". More in [discovery](discovery-01.md#underscore-in-patterns).

Why it matters: it decides what `regex_ilike` does for any pattern containing an underscore, which
the hidden tests of the mock may check.

- **A (recommended). Treat `_` as an ordinary character that matches itself, never as a wildcard.**
  - [pro] equals what production does.
  - [con] "ignored" is read as "not special", not as "removed".
  - Why recommended: the proposal asks the mock to replicate production.
- **B. Remove `_` from the pattern before matching.**
  - [pro] the most literal reading of "ignored".
  - [con] "a_b" then matches "ab" and not "a_b", unlike production.

**Answer:** Your call: A

## Q5: Should the year rule for the name search stay as it is today?

Today a name match is kept when dates are missing on one side, or when one date string starts with
the other. The proposal wants an exact year match for both dates to take precedence when both are
given. It also says the name search falls back to name-only matching when either input date is
missing. More in [discovery](discovery-01.md#which-dates-must-match).

Why it matters: it decides whether the name search becomes stricter, which could stop some imports
from matching authors they match today.

- **A (recommended). Keep today's permissive filter for the name search, and rank an exact year
  match on both dates above other matches. The two new searches use a strict year helper.**
  - [pro] no existing import stops matching.
  - [con] the name search stays more permissive than the other two.
  - Why recommended: it keeps today's behaviour and adds the priority the proposal states.
- **B. Make the name search strict as well: with both input dates, only exact year matches count.**
  - [pro] one strict rule for all three searches.
  - [con] a candidate with a missing date no longer matches, unlike today.

**Answer:** A: exact year match on both dates takes precedence; name-only fallback when a date is
missing

## Settled without the human

### Check these

- **Strict year helper** is a new function in
  [`catalog/utils`](/openlibrary/catalog/utils/__init__.py), shared by the two new searches, so the
  year rule has one home. See [discovery](discovery-01.md#rules-and-their-owners).
- **No stored surname** is added to the author type: the proposal does not ask for a new field. See
  [discovery](discovery-01.md#there-is-no-surname-to-match-on).

### Behaviour

- **Wildcard input** such as "John*" returns the candidate with the lowest numeric key, using
  `key_int`. With no match, the import keeps the name, `*` included. See
  [discovery](discovery-01.md#wildcard-in-the-input-name).
- **Candidates returned** by `find_author` come from the first search that finds any date-valid
  candidate, so a name match is never mixed with a weaker one. `find_entity` picks one or returns
  `None`. See [discovery](discovery-01.md#find_author-returns-candidate-author-records).
- **Organisations** keep the existing branch: `entity_type` other than `person` skips date logic.
- **Redirected authors** are followed for the results of every search.
- **The flipped name** ("Smith, John") stays part of the name search.

### Under the hood

- **Mock operator** `~` uses `regex_ilike`: full-string, case-insensitive, `*` as a multi-character
  wildcard. Existing `key~` queries with a trailing `*` keep working.
- **Tests** cover each priority step, case variants, missing dates, wildcards, and the mock method.
  See [discovery](discovery-01.md#likely-changes).

**Notes:**
