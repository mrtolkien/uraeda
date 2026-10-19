---
status: approved
revision: 3
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Match authors on alternate names and surname with birth and death dates

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve imports finding the existing author by name, then alternate name, then surname,
>   ignoring case and checked against birth and death years.
> - Changed since your review: the mock's `~` now removes every `_` from a pattern before matching,
>   as the proposal says, so "Jo_hn" fits "John". This replaces the settled point that read `_` as a
>   literal underscore. Nothing else changed.
> - Mock and production differ on `_`: the vendored infogami still matches `_` as a literal
>   underscore, so a stored name holding `_`, like "Foo_Bar", is found in production but not in the
>   tests.
> - Unverified: production's query operator is a case-sensitive `LIKE` in the vendored infogami.
>   Case-insensitive matching is proven against the mock only, and holds in production only once
>   infogami does `ILIKE`. A note in the inbox tracks it.
> - Unverified: the surname lookup's pattern starts with a wildcard, so in production it reads the
>   whole author name table, once per imported author that reaches it.
> - Wrong merges and wildcards: a "Jane Smith" 1900-1950 receives a book by an unknown "John Smith"
>   1900-1950, and an account allowed to import can attach a book with a pattern like "Tolk*".
> - Risk tier medium: no stored data changes, but which author receives a book changes for every
>   import. The plan goes straight to implementation.

When a book is imported, each of its authors is either linked to an existing Open Library author or
created as a new one. Today the lookup compares the exact name only, so a change of case, a variant
name, or a name with initials creates a duplicate author. This feature lets
[`find_entity`](/openlibrary/catalog/add_book/load_book.py) try the name, then stored alternate
names, then the surname, ignoring case, with birth and death years telling same-name people apart.
It serves catalogue users, who see fewer duplicate and wrongly credited authors, and the people who
merge duplicates by hand today. See the [proposal](proposal.md), the [discovery](discovery-01.md),
and the [answered questions](clarifications-01.md).

## Your review

- **C1** (mock ILIKE must ignore `_`): done. `regex_ilike` removes every `_` from the pattern before
  matching, so "Jo_hn" fits "John" and "J_hn" does not. The comment sits on the dates row, but is
  about the `_` row below it: that row, the architecture's `regex_ilike` item, and SC-003 now say
  so. The dates row is unchanged.

## Decisions

This spec creates, changes, or removes no decision.

Relied on: no active decision applies to this feature.

## User stories

The scenarios below run against these stored authors, unless a scenario says otherwise:

| Key   | `name`            | `alternate_names` | `birth_date`         | `death_date` |
| ----- | ----------------- | ----------------- | -------------------- | ------------ |
| OL2A  | William H. Brewer |                   | 1829                 | 1910         |
| OL10A | William H. Brewer |                   | 1829                 | 1910         |
| OL3A  | Harry Brewer      | Henry Bruar       | September 14th, 1829 | 11/2/1910    |
| OL4A  | Anne Brewer       |                   | 1829                 | 1911         |
| OL5A  | Jo Smith          |                   | 1850                 |              |

An import's author is a dict like
`{"name": "William H. Brewer", "birth_date": "1829", "death_date": "1910"}`, and its "years" are the
first four-digit year in each date.

### US1: Match the name, ignoring case, with both years (P1)

An importer sends an author whose name differs from the stored one only in case. The import links to
the existing author, and when it carries both dates, to the one whose years agree.

Key scenarios:

1. **Given** the stored authors, **When** an import sends "WILLIAM H. BREWER" born "1829" died
   "1910", **Then** `find_entity` returns OL2A, the lowest numeric key, not OL10A.
2. **Given** the stored authors, **When** an import sends "William H. Brewer" with no dates,
   **Then** `find_entity` returns OL2A.
3. **Given** the stored authors, **When** an import sends "William H. Brewer" born "1829" died
   "1912", **Then** no name or surname candidate has both years, and `import_author` returns a new
   candidate with the name "William H. Brewer", born "1829", died "1912".

More scenarios:

1. **Given** the stored authors, **When** an import sends "Brewer, William H." born "1829" died
   "1910", **Then** the flipped name "William H. Brewer" is looked up too, and `find_entity` returns
   OL2A.
2. **Given** the stored authors, **When** an import sends "Jo Smith" born "1850" died "1900",
   **Then** no candidate has both years exact, OL5A has the same birth year and no death date, so
   `find_entity` returns OL5A and `import_author` fills in its death date "1900".
3. **Given** the stored authors and OL6A "Jo Smith" born "1851", **When** an import sends "Jo Smith"
   born "1851" with no death date, **Then** `find_author` returns OL6A then OL5A, the agreeing birth
   year first, and `find_entity` returns OL6A.
4. **Given** OL7A "Acme Press" with `entity_type` organization, **When** an import sends the
   organization "ACME PRESS" with no dates, **Then** `find_entity` returns OL7A.

### US2: Match a stored alternate name, with both years (P2)

An importer sends an author under a variant of the stored name, such as a transliteration. The
import links to the author whose `alternate_names` holds it, only when both years agree.

Key scenarios:

1. **Given** the stored authors, **When** an import sends "henry bruar" born "1829" died "1910",
   **Then** no name matches, OL3A's alternate name and years match, and `find_entity` returns OL3A.
2. **Given** the stored authors, **When** an import sends "Henry Bruar" with no dates, **Then**
   `find_entity` returns `None`: an alternate name needs both dates.
3. **Given** the stored authors and OL8A "Henry Bruar" with no dates, **When** an import sends
   "Henry Bruar" born "1829" died "1910", **Then** `find_entity` returns OL3A: a same-name author
   without dates never beats an alternate name with both years exact.

More scenarios:

1. **Given** only OL9A "Hal Bruar", with the alternate name "Henry Bruar" and no dates, **When** an
   import sends "Henry Bruar" born "1829" died "1910", **Then** `find_entity` returns `None`: the
   candidate needs both years.

### US3: Match the surname, with both years (P3)

An importer sends a fuller or shorter form of a stored name, such as initials or an honorific. The
import links to a stored author whose name ends with the same surname, only when both years agree.

Key scenarios:

1. **Given** the stored authors, **When** an import sends "Mr. Harry J. Brewer" born "1829" died
   "1910", **Then** the surname "Brewer" matches OL2A, OL3A, and OL10A with both years, and
   `find_entity` returns OL2A, the lowest key, even though OL3A is a Harry.
2. **Given** the stored authors, **When** an import sends "Brewer, A." born "1829" died "1911",
   **Then** the surname is "Brewer", OL4A matches both years, and `find_entity` returns OL4A.
3. **Given** the stored authors, **When** an import sends "Mr. Harry J. Brewer" born "1829" with no
   death date, **Then** `find_entity` returns `None`.

More scenarios:

1. **Given** the stored authors, **When** an import sends "Mr. Harry J. Brewer" born "1829" died
   "1912", **Then** `find_entity` returns `None`.

### US4: Name patterns with a wildcard (P4)

An importer sends a name with `*`, which stands for any run of characters. The import links to the
first author by numeric key whose whole name fits the pattern, or keeps the `*` in a new author.

Key scenarios:

1. **Given** the stored authors, **When** an import sends "william*" with no dates, **Then**
   `find_entity` returns OL2A.
2. **Given** the stored authors, **When** an import sends "Zed*" born "1829" died "1910", **Then**
   `import_author` returns a new candidate with the name "Zed*", born "1829", died "1910".

## Architecture

The lookups stay in [`load_book.py`](/openlibrary/catalog/add_book/load_book.py), and query through
infogami's `~` operator, the only pattern operator it has. The mock site's `~` becomes the
case-insensitive full-string match the proposal describes; infogami stays unchanged, as you chose
([case-insensitive queries](discovery-01.md#case-insensitive-queries)). The order of the steps
follows your answers on [precedence](discovery-01.md#precedence),
[dateless alternate-name candidates](discovery-01.md#alternate-name-candidates-without-dates), and
the [surname](discovery-01.md#surname).

- **`find_author(author)`** takes the import's author dict and returns the matching stored authors,
  best first. It owns the matching rules. It runs the steps below in order, and returns the
  candidates of the first step that keeps any, sorted by numeric key, after following redirects:
  1. The name and, for "Surname, Forename", its flipped form, with both years exact.
  2. The same names with today's tolerant date rule, `author_dates_match`, on a candidate that has a
     birth date: a missing death date passes.
  3. The same names among `alternate_names`, on a candidate with both years exact.
  4. The surname, on a candidate with both years exact.

  Steps 1 to 4 run only when the import has both dates and is a person. Otherwise there is a single
  step, the name and its flipped form alone. Candidates with the import's one year come first, then
  the others, each group by key. An organization uses the name alone, without its flipped form.

- **`find_entity(author)`** returns the first candidate of `find_author`, or `None`. The death-date
  fill-in and the new-candidate path stay in `import_author`, unchanged.
- **The exact-year check** is a private helper in `load_book.py`. It owns the year rule: both sides
  have a four-digit year, found with `re_year`, and they are equal. `author_dates_match` stays as it
  is.
- **The surname** is a private helper: the text before the first ", " of the import's name, or else
  its last word. It is matched with the pattern `* <surname>`, so it fits stored names ending with a
  space and the surname.
- **`MockSite.regex_ilike(pattern, text)`**, in
  [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py), owns the mock's `~` semantics. It
  returns whether the whole `text` fits `pattern`, ignoring case. It first removes every `_` from
  `pattern`, then `*` matches any run of characters, and every other character is literal. The
  mock's `~` filter uses it.
- **A note in [`specs/INBOX.md`](/specs/INBOX.md)** records that production's `~` stays a
  case-sensitive `LIKE` until infogami does `ILIKE`.

Tradeoffs:

- Production matching stays case-sensitive until infogami changes, outside this repository.
- The mock removes `_` from patterns where the vendored infogami matches it literally, so the tests
  cannot catch a lookup of a name holding `_`.
- The surname lookup scans the author name table, since no index serves a leading wildcard.
- Each imported person runs up to five queries: the name and its flipped form, the same two among
  alternate names, and the surname, where today it runs two.

## Edge cases

| Importance | Situation                                                         | What happens                                                                      |
| ---------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| High       | Two people share a surname and both years, and only one is stored | The book links to the stored one; the proposal accepts it                         |
| High       | Several authors match the same step                               | The lowest numeric key wins, OL2A before OL10A                                    |
| High       | A stored author has dates and the import has none                 | The import links to it by name; today it creates a duplicate                      |
| Normal     | A date has no four-digit year, like "15th cent."                  | Steps needing exact years skip it; the tolerant name step still compares as today |
| Normal     | The import's name has no space and no ", ", like "Plato"          | The surname is "Plato", matched against names ending with " Plato"                |
| Normal     | A stored date holds more than a year, like "September 14th, 1829" | Only its year, 1829, is compared                                                  |
| Niche      | The name holds `_`, like "Foo_Bar"                                | The mock looks up "FooBar" and misses a stored "Foo_Bar"; infogami finds it       |
| Niche      | A wildcard name matches more authors than the query limit         | Production may not return the lowest key, since infogami does not sort            |
| Niche      | A query returns a redirect                                        | Redirects are followed as today, and the target is kept once                      |

## Success criteria

- **SC-001** (scenarios): every scenario above passes in
  [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py), against the mock
  site.
- **SC-002** (no regression): every existing test passes, including the mock's `key~` prefix queries
  in [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py).
- **SC-003** (mock semantics): `regex_ilike` returns true for ("john*", "John Smith"), ("*smith",
  "John Smith"), and ("Jo_hn", "John"), and false for ("John", "John Smith"), ("J_hn", "John"), and
  ("Foo_Bar", "Foo_Bar").
- **SC-004** (query count): an imported person runs at most five author queries.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there, except **An underscore in a pattern**: your review asks the mock to remove `_` from a
pattern, as the proposal says, instead of matching a literal underscore. Settled while writing this
spec:

- With both dates, a same-name author without any date matches no step, so the import creates a new
  author, as today.
- The import's one year, when it has only one, orders the name candidates but never removes one.
- Step 1 and step 2 differ only for a stored author missing a death date, or with a date like
  "1829?" that the tolerant rule accepts by prefix.
- The surname step uses the import's `name`, not `personal_name`, so imports from the API reach it.
- No stored data changes, so there is no data model file.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Medium**: no stored data, format, or interface changes beyond the named ones, but every import's
choice of author changes, and a wrong merge is fixed only by hand.

## History

> [!NOTE]
>
> Changes requested on 2026-10-19: Mock ILIKE must ignore _ in patterns
>
> - You approve imports finding the existing author by name, then alternate name, then surname,
>   ignoring case and checked against birth and death years.
> - Changed since your review: the Code quality decision is gone, from the spec and the branch. The
>   spec now creates no decision, and nothing else changed.
> - Unverified: production's query operator is a case-sensitive `LIKE` in the vendored infogami.
>   Case-insensitive matching is proven against the mock only, and holds in production only once
>   infogami does `ILIKE`. A note in the inbox tracks it.
> - Unverified: the surname lookup's pattern starts with a wildcard, so in production it reads the
>   whole author name table, once per imported author that reaches it.
> - Wrong merges: a "Jane Smith" 1900-1950 receives a book by an unknown "John Smith" 1900-1950 when
>   no closer match exists. The proposal accepts this by matching on the surname.
> - Wildcards: an account allowed to import can attach a book to an existing author with a name
>   pattern like "Tolk*", instead of the author's exact name.
> - Risk tier medium: no stored data changes, but which author receives a book changes for every
>   import. The plan goes straight to implementation.

> [!NOTE]
>
> Changes requested on 2026-10-19: Drop the unrequested Code quality decision.
>
> - You approve imports finding the existing author by name, then alternate name, then surname,
>   ignoring case and checked against birth and death years, and recording today's Ruff limits as
>   the project's code-quality decision.
> - New decision, Code quality: today's Ruff limits, unchanged, become binding for every feature.
> - Unverified: production's query operator is a case-sensitive `LIKE` in the vendored infogami.
>   Case-insensitive matching is proven against the mock only, and holds in production only once
>   infogami does `ILIKE`. A note in the inbox tracks it.
> - Unverified: the surname lookup's pattern starts with a wildcard, so in production it reads the
>   whole author name table, once per imported author that reaches it.
> - Wrong merges: a "Jane Smith" 1900-1950 receives a book by an unknown "John Smith" 1900-1950 when
>   no closer match exists. The proposal accepts this by matching on the surname.
> - Wildcards: an account allowed to import can attach a book to an existing author with a name
>   pattern like "Tolk*", instead of the author's exact name.
> - Risk tier medium: no stored data changes, but which author receives a book changes for every
>   import. The plan goes straight to implementation.
