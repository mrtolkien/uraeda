---
status: answered
---

# Clarifications, round 01: Match authors on alternate_names/surname with birth/death date

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes. Production's query engine is case-sensitive, and authors
>   have no surname field, so two requirements need an interpretation.
> - Case-insensitive matching in production: the vendored infogami does `LIKE`, not `ILIKE`, and
>   fixing that sits outside this repository.
> - Precedence and dateless alternate-name candidates work together: both trade duplicate authors
>   against wrong merges.
> - Surname matching: how the surname is derived, and a query no index can serve.
> - A code-quality decision, which lasts beyond this feature.
> - Wildcards: any account allowed to import can link a book to an author by a name pattern.
> - Settled points to check: undated imports will now link to dated authors, and one date alone no
>   longer blocks a name match.

## Context

### Goal

Imports should find the existing Open Library author more often, and the right one. Fewer duplicate
authors get created, and fewer works land on the wrong author. The lookup tries the name, then
alternate names, then the surname, each checked with birth and death years, ignoring case.

### Today

[`find_entity`](/openlibrary/catalog/add_book/load_book.py) is called for every author of every
imported book. It looks up the exact `name`, and the flipped form when the name is "Surname,
Forename". It then drops candidates whose dates disagree, using
[`author_dates_match`](/openlibrary/catalog/utils/__init__.py). That helper is tolerant: a missing
date on either side passes, and so does a date string that starts with the other. Ties go to the
lowest key, like OL1A before OL2A.

| Situation                                            | Today                       | With the proposal           |
| ---------------------------------------------------- | --------------------------- | --------------------------- |
| "JOHN SMITH" against "John Smith"                    | no match                    | match                       |
| Import's name is a stored author's alternate name    | no match                    | match when both years agree |
| "Smith, J." 1900-1950 against "John Smith" 1900-1950 | no match                    | match on the surname        |
| Import without dates, stored author with dates       | no match, duplicate created | match                       |
| Name "John*"                                         | no match                    | first "John…" by key        |

Tests run against a [mock site](/openlibrary/mocks/mock_infobase.py) whose `~` pattern operator is a
case-sensitive prefix match. It also sorts keys as text, so OL10A comes before OL2A.

### Scope

In scope: `find_entity`, a new `find_author(author)` behind it, the mock's `regex_ilike` and `~`
operator, and their tests. Out of scope: author merging, a review queue for doubtful matches, and
punctuation or accent folding, which the proposal does not ask for.

### Sources

- The import code: [`load_book.py`](/openlibrary/catalog/add_book/load_book.py),
  [`add_book/__init__.py`](/openlibrary/catalog/add_book/__init__.py),
  [`marc/parse.py`](/openlibrary/catalog/marc/parse.py), and the
  [author type](/openlibrary/plugins/openlibrary/types/author.type).
- The query engine: the vendored infogami
  [`dbstore.py`](/vendor/infogami/infogami/infobase/dbstore.py) and the
  [mock site](/openlibrary/mocks/mock_infobase.py), with a throwaway experiment on the mock.
- Library practice: [MARC 21 authority 400](https://www.loc.gov/marc/authority/ad400.html),
  [MARC 21 bibliographic 100](https://www.loc.gov/marc/bibliographic/bd100.html), and
  [RDA 9.19](https://web.library.yale.edu/print/book/export/html/3425).
- Tools: [OpenRefine reconciliation](https://openrefine.org/docs/manual/reconciling).
- PostgreSQL: [pattern matching](https://www.postgresql.org/docs/current/functions-matching.html),
  [index types](https://www.postgresql.org/docs/current/indexes-types.html), and
  [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html).
- The full investigation is in [discovery](discovery-01.md).

## Q1: How does matching become case-insensitive in production?

Open Library queries the database through infogami, a separate library vendored in
`vendor/infogami`. Its `~` operator becomes SQL `LIKE`, which is case-sensitive. `*` becomes the `%`
wildcard, and `_` is escaped as a literal underscore. There is no case-insensitive operator. The
proposal asks the mock to "replicate production ILIKE semantics". So either production runs a newer
infogami than the vendored copy, or it does not do ILIKE yet. This could not be verified: the task
forbids looking up upstream solutions, so the infogami repository was not searched.

Speed matters too. PostgreSQL serves `ILIKE` from a normal index only when the pattern starts with a
non-letter. A trigram index (`pg_trgm`) serves any pattern, but the vendored schema has none. Every
imported author would run up to three such queries. More in
[discovery](discovery-01.md#case-insensitive-queries).

Why it matters: it decides whether the feature changes production behaviour on merge, or only once
infogami catches up. It also decides whether this feature touches a second repository.

C can come on top of A.

- **A (recommended). Write the lookups with infogami's `~` operator, and make the mock's `~`
  case-insensitive as the proposal asks. Leave infogami unchanged, and note the production gap in
  the inbox.**
  - [pro] stays within this repository and the proposal's interfaces.
  - [con] if production's `~` is still `LIKE`, imports stay case-sensitive there until infogami
    changes.
  - Why recommended: it is exactly what the proposal specifies, and the infogami question is
    verifiable by whoever deploys it.
- **B. Also change infogami's `~` to `ILIKE` in this feature, and bump the submodule.**
  - [pro] production is case-insensitive on merge.
  - [con] every existing `key~` prefix query becomes `ILIKE`, which no normal index serves.
- **C. Query with an exact `=` first, and use `~` only when the exact query finds nothing.**
  - [pro] the common case, an exact name, keeps using the index.
  - [con] a candidate with the exact casing but wrong years hides a differently cased one with the
    right years, unless both queries always run.

**Answer:** A - your call, proposal only says case-insensitive matching with the mock replicating
ILIKE

## Q2: When several lookups find candidates, which one wins?

The proposal orders the lookups: name, then alternate names, then surname. It also says "an exact
year match for both must take precedence over other matches". It does not say what the other matches
are. Today, a same-name author with compatible but incomplete dates matches. An example is a stored
"John Smith" born 1900 with no death date, against an import "John Smith" 1900-1950. The import then
fills in the death date. The open point is whether that partial name match beats an alternate-name
match with both years exact. Whether dateless alternate-name candidates count is the next question.
More in [discovery](discovery-01.md#precedence).

Why it matters: it decides which existing author receives the book when the evidence conflicts. A
wrong choice creates a duplicate, or merges two people.

- **A (recommended). Try the name with both years exact, then the name with compatible dates as
  today, then alternate names with both years exact, then the surname with both years exact.**
  - [pro] the same name with no conflicting date stays the strongest evidence, and today's
    death-date fill-in keeps working.
  - [con] a name match with partial dates beats an exact-date variant.
  - Why recommended: it follows the proposal's order, name first, and keeps today's behaviour for
    authors who already match.
- **B. Try the name with both years exact, then alternate names, then the surname, and only last the
  name with compatible dates.**
  - [pro] full date agreement always wins.
  - [con] a living author recorded with a birth year only loses to a variant of someone else.
- **C. When the import has both dates, accept only exact years on every lookup.**
  - [pro] the fewest wrong merges.
  - [con] stored authors with a missing death date never match, so imports duplicate them.

**Answer:** Your call, take A - proposal says name first, then alternate_names, then surname

## Q3: Can an alternate-name match link to an author who has no dates?

The proposal says an alternate-name match needs both dates in the import, and that they "exactly
match the candidate's values when dates are available". That can mean the candidate must have both
dates. It can also mean a candidate without dates matches on the variant name alone. For the
surname, the proposal is explicit: no dates, no match. In library authority records, variant names
carry the same dates as the authorized name, which is what makes them safe to follow. Open Library
gets variants from MARC 880 alternate-script fields, and from authors merged by hand. With
precedence, the previous question, this sets how far the import trusts a variant. More in
[discovery](discovery-01.md#alternate-name-candidates-without-dates).

Why it matters: it decides whether a variant name alone can attach a book to an existing author.

- **A (recommended). Require the candidate to have both a birth and a death year, equal to the
  import's.**
  - [pro] the same rule as the surname, and the library practice of variants tied to dates.
  - [con] a variant of an undated author never matches, so a duplicate is created.
  - Why recommended: a variant name is weaker evidence than the name, and the proposal requires
    dates for it.
- **B. Also accept a candidate without any dates when the import's name is one of its alternate
  names.**
  - [pro] fewer duplicates of undated authors.
  - [con] two people sharing a variant, common for transliterated names, get merged.

**Answer:** Your call, take A - proposal says alternate_names needs both dates matching

## Q4: How is the surname found, and what does it match?

Stored authors have no surname field: only `name`, in natural order, like "John Smith". Imports
carry `name`, and often `personal_name` in "Surname, Forename" order from MARC. Surname matching
must derive the surname from the import, then look for stored names ending with it. A pattern like
"* Smith" starts with a wildcard, so no normal index can serve it: the database reads the whole
author name table. The proposal requires both years to agree on this path. More in
[discovery](discovery-01.md#surname).

Why it matters: it decides how many imports reach this lookup, and how many wrong "Smith" matches
the year check must catch.

- **A (recommended). Take the text before the first ", " of the import's `name`, or else its last
  word. Match stored names that end with a space and that surname, ignoring case, with both years
  equal.**
  - [pro] covers both name orders, and every import with dates.
  - [con] one full scan of the author names per import that reaches this step.
  - Why recommended: it covers the most imports, and the year check limits wrong matches.
- **B. Do the same, but only when the import has a `personal_name`, and take the surname from it.**
  - [pro] relies on cataloguer-marked surnames, from MARC subfield `$a`.
  - [con] imports from the API without `personal_name` never use this path.
- **C. Match only stored names equal to the surname alone, like "Smith".**
  - [pro] served by the normal index.
  - [con] almost no stored author has a surname-only name, so the step rarely finds anything.

**Answer:** Your call, take A - proposal says surname needs both dates to match exactly

## Q5: Should the project record its code-quality limits as a decision?

This workflow keeps code-quality limits in a decision, `specs/decisions/code-quality.md`, and the
project has none yet. The project already enforces limits through Ruff in
[`pyproject.toml`](/pyproject.toml). These are a complexity of 28, 23 branches, 70 statements, 15
arguments, and 14 returns per function. Lines are at most 162 characters. Today's code meets them.

Why it matters: the decision binds every later feature and change, and agents read it before each
task.

- **A (recommended). Record today's Ruff limits as the decision, enforced by the existing Ruff
  check, without changing any value.**
  - [pro] no code changes, and agents learn the limits before writing.
  - [con] the limits are loose, so long functions stay possible.
  - Why recommended: it writes down what the project already enforces.
- **B. Record today's limits, and tighten them for new code.**
  - [pro] keeps new functions short.
  - [con] needs markers on today's offenders, a separate piece of work.
- **C. Record that the project wants no limits from this workflow, to revisit in a year.**
  - [pro] nothing to maintain.
  - [con] agents get no limit beyond what Ruff already fails on.

**Answer:** Your call, take A

## Settled without the human

### Check these

- **Undated imports** will link to a same-name author even when the stored author has dates. Today
  they create a duplicate instead. The proposal requires it: "an existing author record must be
  returned if one exists under that name". See [discovery](discovery-01.md#one-date-only).
- **One date only** in the import, like a birth year alone, still returns a name match. Candidates
  whose given year agrees come first, then the others by key. The proposal requires a name match
  here; preferring agreeing years stays within it. See [discovery](discovery-01.md#one-date-only).
- **Wildcards** in imported names are honoured, as the proposal requires. "John*" links to the
  lowest-keyed author whose name starts with "John". Only accounts allowed to import can send such a
  name, and they can already name any author exactly. See
  [discovery](discovery-01.md#wildcards-in-imported-names).
- **An underscore in a pattern** matches a literal underscore, never one character. This is how
  infogami already escapes `_`, and how "`_` ignored in patterns" is read. See
  [discovery](discovery-01.md#infogamis-query-engine-vendored).
- **Alternate names** means the import's `name` looked up among stored authors' `alternate_names`.
  The import's own `alternate_names` are not used, since the proposal does not ask for it. See
  [discovery](discovery-01.md#the-code).

### Behaviour

- **Year comparison** takes the first four-digit year of each date, so "1918." equals "1918". A date
  with no four-digit year, like "15th cent.", cannot match on a path that requires years. See
  [discovery](discovery-01.md#needs-no-choice).
- **Ties** between candidates go to the lowest numeric key, OL2A before OL10A, as the proposal asks.
  See [discovery](discovery-01.md#numeric-key-order).
- **Flipped names** keep working: the name and alternate-name lookups also try "Surname, Forename"
  flipped to "Forename Surname", as today. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Organizations** keep matching on the name alone, now ignoring case, taking the lowest key. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The death date fill-in** stays: a matched author without a death date gets the import's. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **No match** returns a new author candidate with `name`, `birth_date`, and `death_date` unchanged,
  a `*` included. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Under the hood

- **`find_author(author)`** takes the import's author dict and returns the candidate list, sorted by
  numeric key. `find_entity` delegates to it, as the proposal names. See
  [discovery](discovery-01.md#likely-changes).
- **The exact-year check** is a new private helper in `load_book.py`. `author_dates_match` stays as
  it is, with its own tests. See [discovery](discovery-01.md#rules-and-their-owners).
- **The mock's `~`** becomes a full-string, case-insensitive match through `regex_ilike`, with `*`
  as the only wildcard. Existing `key~ "/books/*"` queries keep their results. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **The query limit** stays infogami's default; ordering is done in Python with `key_int`. See
  [discovery](discovery-01.md#numeric-key-order).
- **Tests** go in [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) and
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py), against the mock site.
  See [discovery](discovery-01.md#likely-changes).

**Notes:**
