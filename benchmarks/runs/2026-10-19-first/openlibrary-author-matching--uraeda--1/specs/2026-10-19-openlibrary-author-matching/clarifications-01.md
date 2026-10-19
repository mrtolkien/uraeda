---
status: answered
---

# Clarifications, round 01: Match authors on alternate_names/surname with birth/death date

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes. The proposal holds, but three points are open: production
>   case-insensitivity, undated imports, and what "surname" searches.
> - Case-insensitivity: the infogami in this repository does a case-sensitive search.
> - Undated imports: the proposal reverses a current rule that protects dated authors.
> - Surname search: authors store no surname, so its query is my reading.
> - Settled points to check: what `find_entity` returns, and `_` in mock patterns.

## Context

### Goal

Importing a book should find the right existing author more often. Matching tries name, then
alternate names, then surname, with birth and death dates, ignoring case. This avoids duplicate
authors.

### Today

[`find_entity`](/openlibrary/catalog/add_book/load_book.py) searches the exact name only, plus the
flipped name for "Last, First". It then rejects candidates whose dates disagree. An undated import
never matches a dated author. The mock site has no ILIKE support.

### Scope

It covers `find_entity`, `find_author`, and the mock `regex_ilike`. It does not change infogami, the
search index, or author merging.

### Sources

- [load_book.py](/openlibrary/catalog/add_book/load_book.py),
  [mock_infobase.py](/openlibrary/mocks/mock_infobase.py), and
  [dbstore.py](/infogami/infobase/dbstore.py). The full investigation is in
  [discovery](discovery-01.md).

## Q1: How is production search made case-insensitive?

The query operator `~` becomes SQL `LIKE` in the infogami here, which is case-sensitive. The
proposal says production uses ILIKE. The submodule is not checked out, so I could not confirm it.
More in [discovery](discovery-01.md#case-insensitive-search-in-production).

Why it matters: if production is case-sensitive, "john smith" will not find "John Smith" whatever
the code here does.

- **A (recommended). Query with the `~` operator, assume production does ILIKE, and make the mock
  behave as ILIKE.**
  - [pro] matches the proposal and stays inside this repository.
  - [con] unverified here: a case-sensitive production would miss differently cased names.
  - Why recommended: the proposal states production semantics, and the submodule is out of scope.
- **B. Do A, and also bump the infogami submodule to a version with ILIKE.**
  - [pro] makes production behaviour certain.
  - [con] changes a dependency the proposal does not mention.
- **C. Fetch broader candidates and compare case in Python.**
  - [pro] works with any infogami.
  - [con] cannot find candidates the case-sensitive query already misses.

**Answer:** A

## Q2: What happens when the import has no birth or death date?

The proposal says to fall back to name matching alone and return an existing author if one exists.
Today a dated record is rejected for an undated import. More in
[discovery](discovery-01.md#dates-when-one-is-missing).

Why it matters: it decides whether an undated import can attach to a dated author, which may merge
two different people with the same name.

- **A (recommended). Match on case-insensitive name alone and ignore all dates, as the proposal
  reads.**
  - [pro] follows the requirement literally.
  - [con] may link an import to a different author of the same name.
  - Why recommended: it keeps the requirement as written.
- **B. Match on name, but still reject a candidate when a date both sides have differs by year.**
  - [pro] fewer wrong merges.
  - [con] goes beyond the literal requirement.

**Answer:** A: fall back to case-insensitive name matching alone

## Q3: What does the surname search look for?

Authors have no surname field. The search must derive one from the input name. More in
[discovery](discovery-01.md#what-the-surname-path-searches).

Why it matters: it decides which records the last, loosest step can find, and so how risky it is.

- **A (recommended). Take the last word of the input name as the surname and match records whose
  name ends with it, case-insensitively, with both dates equal by year.**
  - [pro] finds "John Smith" for "J. Smith", with both dates as protection.
  - [con] a common surname with the same dates could match a wrong person.
  - Why recommended: it is the only reading that finds anything the name step missed.
- **B. Match records whose whole name equals the surname, with both dates equal by year.**
  - [pro] very strict.
  - [con] it almost never matches.

**Answer:** Your call, take recommended A

## Settled without the human

### Check these

- **What `find_entity` returns** is the existing record or `None`. `import_author` builds the new
  candidate and keeps `name`, `birth_date`, `death_date`, and `*` unchanged. See
  [discovery](discovery-01.md#find_entity-returns-a-candidate-or-none).
- **Underscore in mock patterns** is ignored, as the proposal says, though production escapes it.
  See [discovery](discovery-01.md#_-is-ignored-in-mock-patterns).

### Behaviour

- **Wildcards** such as `John*` return the first candidate by numeric key order. See
  [discovery](discovery-01.md#the-code).
- **Non-person entities** keep their current first-name-match behaviour. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Flipped names** ("Last, First") are still searched in the name step.

### Under the hood

- **Date comparison** uses years only, through the existing `author_dates_match` where it applies.
- **Mock indexing of `alternate_names`** is checked by the plan's first task.

**Notes:**
