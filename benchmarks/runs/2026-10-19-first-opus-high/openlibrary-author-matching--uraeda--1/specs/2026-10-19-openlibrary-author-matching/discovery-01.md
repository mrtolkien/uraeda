# Discovery, round 01: Match authors on alternate_names/surname with birth/death date

## Summary

Author matching at import time decides whether an incoming author is an existing Open Library author
or a new one. Library practice uses the authorized name plus birth and death years to tell same-name
people apart. It records variant names (MARC 400 "see from" tracings) that carry the same dates, so
a variant plus dates points to one person. Reconciliation tools such as OpenRefine score candidates
on name plus extra properties, and auto-match only when confident.

The proposal asks for a three-step lookup in
[`find_entity`](/openlibrary/catalog/add_book/load_book.py): name, then `alternate_names`, then
surname, each with birth and death years, all case-insensitive, with `*` wildcards. Today the code
matches on the exact `name` only, plus its flipped form ("Smith, John" → "John Smith"). It tolerates
missing dates on one side, and never looks at `alternate_names` or surnames.

Three things stand in the way. Authors have no `surname` field to query. The vendored infogami turns
the `~` query operator into a case-sensitive SQL `LIKE`, not `ILIKE`. The mock site's `~` is a
prefix match, and it sorts keys as strings, so `OL10A` comes before `OL2A`.

## How other products do it

### Library of Congress name authorities (MARC 21)

- Field 100 holds "the established form of a personal name"; `$d` holds "Dates associated with a
  name". [MARC 21 Authority 100](https://www.loc.gov/marc/authority/ad100.html)
- Field 400 traces "a personal name not used in an established heading", a variant form that sends
  searches to the established one. Its examples carry the same `$d` dates as the heading, for
  example Beethoven's variants with 1770-1827.
  [MARC 21 Authority 400](https://www.loc.gov/marc/authority/ad400.html)
- In bibliographic records, field 100's first indicator says whether the entry element is a forename
  (0), a surname (1), or a family name (3), as in "Adams, Henry,$d1838-1918". Dates take many forms:
  "1919-", "d. 1632", "fl. 1706-1739", "1225?-1274", "15th cent.".
  [MARC 21 Bibliographic 100](https://www.loc.gov/marc/bibliographic/bd100.html)

### RDA and LC-PCC practice

- RDA 9.19.1.3 says to "Add the date of birth ... and/or date of death ... if needed to distinguish
  one access point from another". The examples record the year alone, and add month or day only when
  the year is not enough. When nothing can distinguish two people, they share one undifferentiated
  access point.
  [Yale Library RDA 9.19 guide](https://web.library.yale.edu/print/book/export/html/3425)
- LC-PCC practice adds birth and death dates to every new authority record, even without a conflict.
  [Yale Library RDA 9.19 guide](https://web.library.yale.edu/print/book/export/html/3425); also seen
  in search results for an FDLP training document (snippet only, see [Not checked](#not-checked)).

### OpenRefine reconciliation

- A confident match is shown as a single link that "you should not have to check manually";
  otherwise "one or more candidates are displayed, together with their reconciliation score".
  [OpenRefine manual: Reconciling](https://openrefine.org/docs/manual/reconciling)
- Extra columns sent as properties help "find better matches", for example the author or the
  publication date when reconciling books.
  [OpenRefine manual: Reconciling](https://openrefine.org/docs/manual/reconciling)

### MusicBrainz

- Same-name artists are told apart by a disambiguation comment, begin and end dates, and aliases.
  [MusicBrainz Style/Artist](https://musicbrainz.org/doc/Style/Artist) (seen in search results
  only). Third-party matchers built on it show the classic failure: several bands named "Ossuary"
  mixed up when only the name was compared (forum thread, search snippet only).

### What they have in common

- **Dates disambiguate same-name people, at year precision.** Months and days are the exception.
- **Variant names point to one authorized record**, and carry the same dates.
- **A weak signal alone does not auto-merge.** Surname-only or variant-only matches need a second
  property, such as dates, before a tool links them without review.
- **Dates are messy**: open ranges, "d." or "fl." prefixes, question marks, and centuries.
- **Case and punctuation differ between sources**, so names are normalized before comparing.

## Standards and libraries

### PostgreSQL pattern matching

- `LIKE` "always covers the entire string"; `%` matches any sequence and `_` any single character.
  The default escape character is the backslash.
  [PostgreSQL 18: Pattern Matching](https://www.postgresql.org/docs/current/functions-matching.html)
- "The key word `ILIKE` can be used instead of `LIKE` to make the match case-insensitive according
  to the active locale"; it is a PostgreSQL extension.
  [PostgreSQL 18: Pattern Matching](https://www.postgresql.org/docs/current/functions-matching.html)

### PostgreSQL indexes

- A B-tree index serves `LIKE` only for a constant pattern "anchored to the beginning of the
  string", and outside the C locale only with a special operator class. It serves `ILIKE` "only if
  the pattern starts with non-alphabetic characters".
  [PostgreSQL 18: Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- A `pg_trgm` GIN or GiST index serves `LIKE` and `ILIKE`, and "the search string need not be
  left-anchored". A pattern with no extractable trigrams "will degenerate to a full-index scan".
  [PostgreSQL 18: pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)

### Infogami's query engine (vendored)

- [`dbstore.py`](/vendor/infogami/infogami/infobase/dbstore.py) turns `key~ value` into `LIKE`,
  replacing `*` with `%` and escaping `_` as a literal underscore. `%` passes through as a wildcard.
  The match is case-sensitive.
- [`readquery.py`](/vendor/infogami/infogami/infobase/readquery.py) knows the operators `!=`, `=`,
  `<`, `<=`, `>=`, `>`, and `~`: there is no case-insensitive operator.
- [`schema.sql`](/vendor/infogami/infogami/infobase/_dbstore/schema.sql) indexes each property table
  on `(key_id, value)` with a plain B-tree.

## The code

### Important reads

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(name)` queries
  `{'type': '/type/author', 'name': name}` with an exact `=`, then follows redirects.
  `find_entity(author)` adds the flipped name when the name holds ", ". It skips candidates lacking
  a birth date when the import has one, and the reverse. Then it filters with `author_dates_match`,
  and `pick_from_matches` takes the lowest key among the best-dated. For an organization
  (`entity_type` other than `person`), it returns the first name hit, without dates. The file is 300
  lines and its functions are short: nothing to split first.
- [`catalog/utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): `author_dates_match` passes
  when either side lacks a date, or when one date string starts with the other. Otherwise it
  compares the first four-digit year (`re_year`). `key_int` turns `/authors/OL12A` into 12.
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `MockSite.things` filters an in-memory
  index. Its `~` is `startswith(value without trailing *)`, case-sensitive. It returns keys sorted
  as strings, with a default limit of 100.
- [The author type](/openlibrary/plugins/openlibrary/types/author.type): `name`, `personal_name`,
  `alternate_names` (a list of strings), `birth_date`, `death_date`, and `date` are stored. There is
  no `surname` property.
- [`marc/parse.py`](/openlibrary/catalog/marc/parse.py): MARC imports give `name`, `personal_name`,
  dates, `entity_type`, and sometimes `alternate_names` from an 880 alternate-script field.
  [`import_edition_builder.py`](/openlibrary/plugins/importapi/import_edition_builder.py) gives
  `name`, `personal_name`, and dates from the import API.
- [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) covers name order and
  honorifics, with `find_entity` stubbed out: there is no test of `find_entity` today.
- `git log` on these files: the last change is the honorifics removal (0d13e6b4b, March 2024), which
  runs before `import_author` in `build_query`.

A throwaway test against the mock (not committed) gave, for authors OL1A, OL2A, and OL10A named
"John Smith" with alternate name "Jean Smith":

| Query                           | Result                             |
| ------------------------------- | ---------------------------------- |
| `name: 'John Smith'`            | `OL10A, OL1A, OL2A` (string order) |
| `name: 'john smith'`            | nothing                            |
| `alternate_names: 'Jean Smith'` | `OL10A, OL1A, OL2A`                |
| `name~: 'John*'`                | `OL10A, OL1A, OL2A`                |
| `name~: '*Smith'`               | nothing (prefix match only)        |

### The proposal's path and existing actions

- **Import path**: `add_book.load` → `build_query` → `remove_author_honorifics` → `import_author` →
  `find_entity`. A match returns the existing record, and fills its `death_date` when only the
  import has one. No match flips "Surname, Forename" and returns a new candidate.
  [`add_book/__init__.py`](/openlibrary/catalog/add_book/__init__.py) calls `import_author` twice
  more, in `load_data` and when a work has no authors.
- **Import with no dates, existing author with dates**: today, no match (the birth-date check skips
  it), so a duplicate is created. The proposal's "fall back to name matching alone" makes it match.
- **Import with both dates, existing same-name author without dates**: today, no match.
- **Import with a birth date, existing author with only a birth date**: today, a match, then the
  death date is filled in.
- **Different casing**: today, "JOHN SMITH" never matches "John Smith".
- **Name with a `*`**: today, an exact-match query, so no match; with the proposal, a wildcard.
- **Redirected authors**: `find_author` follows redirects; a query on `type: /type/author` never
  returns redirects, so this path only matters for direct key fetches.
- **Organizations**: matched on name only, first hit.

### Rules and their owners

- **Author identity at import** is owned by `find_entity`; `pick_from_matches` owns the tie-break.
- **Date comparison** is owned by `author_dates_match`, tested in
  [`test_utils.py`](/openlibrary/tests/catalog/test_utils.py). Its tolerant rule (prefixes, missing
  sides) differs from the proposal's exact-year rule.
- **The `~` operator's meaning** has two homes that already disagree: infogami's `dbstore.py`
  (full-string `LIKE`) and the mock's prefix `startswith`. Other code relies on `~` as a prefix
  wildcard: `key~` in [`core/models.py`](/openlibrary/core/models.py),
  [`upstream/utils.py`](/openlibrary/plugins/upstream/utils.py), and the mock's own tests in
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py), all ending in `*`.

### Likely changes

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(author: dict)`, the
  three lookups, and `find_entity` delegating to it. Under every option.
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `MockSite.regex_ilike`, and `~` using
  it. Under every option.
- [`catalog/utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): an exact-year helper next
  to `author_dates_match`, or a private one in `load_book.py`.
- [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) and
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py): new tests.
- `vendor/infogami`: only with option B of [case-insensitive queries](#case-insensitive-queries).

## The proposal

### Production does not do ILIKE

The proposal asks the mock to "replicate production ILIKE semantics". The vendored infogami's `~` is
a case-sensitive `LIKE`. Either the deployed infogami differs from the vendored copy, or production
stays case-sensitive after this feature. Which one could not be verified (see
[Not checked](#not-checked)).

### There is no surname field

"Match on surname" needs a surname on both sides. Imports carry a `name` and often a `personal_name`
in "Surname, Forename" order. Stored authors have only `name`, in natural order. The surname must be
derived from the import, and matched against the end of stored names.

### Precedence across steps with partial dates

"An exact year match for both must take precedence over other matches" leaves open what the other
matches are. A same-name author with a compatible but incomplete date, like a birth year only, is
matched today. The proposal does not say whether it beats an exact-date alternate-name match.

### Candidates without dates on the alternate-name path

"Exactly match the candidate's values when dates are available" can read two ways. Either an
alternate-name candidate without dates still matches, or it never does. The surname rule is
explicit: it never does.

### One date only

"When either date is absent, fall back to name matching alone, and an existing author record must be
returned." Today, an import with a birth year skips same-name authors with another birth year. Read
literally, the proposal links them.

### Wildcards in imported names

A `*` in an imported name becomes a wildcard: "John*" links the book to the lowest-keyed author
whose name starts with "John". Only accounts allowed to import can send one: bots, admins, and the
`api` usergroup ([`can_write`](/openlibrary/plugins/openlibrary/code.py)). MARC data does not use
`*` in names.

### Numeric key order

"The first candidate according to numeric key ordering" is not what the mock returns (string order),
nor what infogami guarantees (no `ORDER BY` in the query). The order must come from `key_int` in
`find_author`.

## Worth it and feasibility

- **Gain**: fewer duplicate authors from case differences, from MARC variant names, and from
  "Surname, Forename" against stored names with initials, when both dates agree. Duplicates are
  merged by hand today ([`merge_authors.py`](/openlibrary/plugins/upstream/merge_authors.py)).
- **Cost**: one function rewritten and a mock operator, a few days with tests. No new dependency.
- **Wrong merges** are the main risk: the surname path matches any "X Smith" with the same years.
  Requiring both years, as the proposal does, is the library practice for telling people apart.
- **Unverified outside behaviour**: whether production infogami's `~` is case-insensitive, and how
  fast `ILIKE` with a leading `*` runs on the author tables. Without a trigram index, PostgreSQL
  scans the whole property table for such a pattern. Three such queries per imported author could
  load the database during bulk imports. Neither can be checked from this repository.
- **Relaxed guard**: with wildcards, an account allowed to import can link a book to an existing
  author by a pattern, instead of by the exact name. It could already name that author exactly, so
  the gain to an attacker is small.

## Approaches

Criteria: the proposal's requirements kept as written ([constitution II](/specs/CONSTITUTION.md)),
nothing beyond what it asks ([constitution I](/specs/CONSTITUTION.md)), wrong merges against
duplicates, and production load.

### Case-insensitive queries

How the lookups become case-insensitive in production, given [ILIKE](#production-does-not-do-ilike).

| Option                                                                                | Requirements | Scope                                      | Production                              |
| ------------------------------------------------------------------------------------- | ------------ | ------------------------------------------ | --------------------------------------- |
| A. Use `~` in `find_author`, make the mock's `~` ILIKE-like, and leave infogami as is | met in tests | this repo only                             | case-sensitive until infogami changes   |
| B. Also change infogami's `~` to `ILIKE`                                              | met          | another repository, and every `key~` query | case-insensitive, slower prefix queries |
| C. Query exact `=` first, then `~`                                                    | met in tests | this repo only                             | indexed path for the common case        |

C can come on top of A.

### Precedence

What wins when several steps find candidates. See
[precedence across steps](#precedence-across-steps-with-partial-dates).

| Option                                                                  | Same name, compatible partial dates | Wrong-merge risk | Duplicates |
| ----------------------------------------------------------------------- | ----------------------------------- | ---------------- | ---------- |
| A. Name exact years → name compatible dates → alternate names → surname | matched before variants             | low              | low        |
| B. Name exact years → alternate names → surname → name compatible dates | matched last                        | low              | low        |
| C. Exact years only on every path when both dates are given             | never matched                       | lowest           | more       |

### Alternate-name candidates without dates

See [candidates without dates](#candidates-without-dates-on-the-alternate-name-path).

| Option                                                       | Wrong-merge risk | Matches a MARC 880 variant of an undated author |
| ------------------------------------------------------------ | ---------------- | ----------------------------------------------- |
| A. The candidate must have both years, equal to the import's | low              | no                                              |
| B. A candidate without dates matches on the variant alone    | higher           | yes                                             |

### Surname

How the surname is found, and what it matches. See [no surname field](#there-is-no-surname-field).

| Option                                                      | Source of the surname | Stored names matched       | Cost                         |
| ----------------------------------------------------------- | --------------------- | -------------------------- | ---------------------------- |
| A. Text before the first ", " of `name`, else its last word | import                | names ending in " Surname" | leading-wildcard query       |
| B. Same, but only from `personal_name` when present         | import                | same                       | same, fewer imports covered  |
| C. Match stored names equal to the surname alone            | import                | "Smith" only               | indexed, almost never useful |

### Needs no choice

- **Year precision**: the proposal asks for the year only, as RDA does.
- **Messy dates**: the four-digit year is extracted with the existing `re_year`; a date without one
  cannot match on the date-requiring paths.
- **Case and punctuation**: case is in scope; punctuation and accents are not asked for.
- **Review of weak matches**: the proposal auto-matches; a review queue is not asked for.

## Not checked

- **Which infogami production runs**, and whether its `~` is case-insensitive. The vendored copy has
  no git history here, and the task forbids looking up existing solutions or upstream pull requests,
  so the upstream infogami repository was deliberately not searched.
- **Production database locale, indexes, and author table size**: not in the repository.
- **MusicBrainz Style/Artist, the FDLP RDA training document, and the "Ossuary" forum thread**: seen
  as search snippets only.
