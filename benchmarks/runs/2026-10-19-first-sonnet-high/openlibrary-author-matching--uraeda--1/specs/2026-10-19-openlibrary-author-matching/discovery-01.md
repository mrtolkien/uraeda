# Discovery, round 01: Match authors on alternate names and surname with birth and death dates

## Summary

When a book is imported, `import_author` asks `find_entity` for an existing author. Today
`find_entity` searches by name only, plus the flipped name ("Smith, John" becomes "John Smith"),
then drops candidates whose dates disagree. The proposal adds two fallbacks, `alternate_names` and
surname, each requiring both dates. It makes every search case-insensitive and supports `*`
wildcards. It splits the lookup so that `find_author(author: dict)` returns candidates and
`find_entity` delegates to it. It adds `MockSite.regex_ilike` so the tests' fake database behaves
like production.

Three facts in the code do not fit the proposal as written: there is no stored surname, the vendored
production query operator is case-sensitive `LIKE`, and the mock's `~` operator is a prefix match.
All three become questions. The proposal asks for no product comparison, and its constraints forbid
looking up existing solutions, so this round reads only the repository and the database
documentation the code relies on.

## How other products do it

Not researched. The proposal's constraints forbid consulting existing solutions, external pull
requests, or online workarounds. The feature is internal to one import path and has no user-facing
behaviour that products could inform.

## Standards and libraries

### The query operator in the vendored infobase

- [`dbstore.py` lines 293-295](/vendor/infogami/infogami/infobase/dbstore.py): the `~` operator
  becomes SQL `LIKE`, with `*` replaced by `%` and `_` replaced by `\_`. `LIKE` is case-sensitive in
  PostgreSQL. No `ILIKE` appears anywhere in the repository except the proposal.
- [`readquery.py` line 242](/vendor/infogami/infogami/infobase/readquery.py): `~` is the only
  pattern operator the query language accepts.
- `vendor/infogami` is a git submodule of [internetarchive/infogami](/.gitmodules), so a change to
  its operator is not a change of this repository.
- The proposal says "production ILIKE semantics". What is checked: the vendored code at this commit
  does not produce them. Not verified: whether the production database wraps or patches this code.

### Underscore in patterns

- The same `dbstore.py` lines turn `_` into `\_`, so production treats `_` as a literal underscore
  and not as the SQL single-character wildcard. The proposal says "`_` ignored in patterns", which
  can be read as "not a wildcard" or as "removed".

## The code

### Important reads

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(name)` (line 134) runs
  one `things` query `{'type': '/type/author', 'name': name}`, loads each result, and follows
  redirects. `find_entity(author)` (line 160) calls it for the name, and again for `flip_name(name)`
  when the name holds ", ". It then skips candidates when exactly one side has a `birth_date`, and
  when `author_dates_match` fails. It returns the single match, or `pick_from_matches`.
- `find_entity` has a separate branch for `entity_type` other than `person`: it returns the first
  name match with no date check.
- [`pick_from_matches`](/openlibrary/catalog/add_book/load_book.py): prefers candidates that have
  both dates when the input has both, otherwise the lowest `key_int`.
- [`author_dates_match`](/openlibrary/catalog/utils/__init__.py): permissive. A missing date on
  either side passes, and a date passes when one string starts with the other. Otherwise the first
  four-digit year of each must be equal.
- [`key_int`](/openlibrary/catalog/utils/__init__.py): the number in an author key, used for "first
  candidate according to numeric key ordering".
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `things()` (line 167) filters with
  `filter_index`. Its `~` operation is `value.startswith(query.rstrip('*'))`: case-sensitive, and
  `*` only counts at the end. `limit` defaults to 100 and results are sorted by key as text.
- [`author.type`](/openlibrary/plugins/openlibrary/types/author.type): the author type has `name`,
  `personal_name`, `alternate_names` (a list of strings), `birth_date`, `death_date`, `title`, and
  `eastern_order`. It has no surname property.
- [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) stubs `find_entity`.
  [`test_add_book.py`](/openlibrary/catalog/add_book/tests/test_add_book.py) exercises authors
  through `mock_site`, for example `test_load_deduplicates_authors`,
  `test_load_with_redirected_author`, and `test_author_from_700`.
- [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py) lines 64-65 test `key~`
  with a trailing `*`.
- Commit `0d13e6b4b` added honorific removal to the same file. The pattern to follow is small
  module-level functions with docstrings and type hints.

### The proposal's path and existing actions

1. An import record reaches `import_author`, which calls `find_entity(author)`.
2. Today: name, then flipped name, then date filtering. With the proposal: name with dates, then
   `alternate_names` with dates, then surname with dates. Each step is case-insensitive.
3. If nothing is found, `import_author` flips the name with `do_flip` and returns a candidate with
   `name`, `title`, `personal_name`, `birth_date`, `death_date`, `date`. The requirement to preserve
   `name`, `birth_date`, and `death_date` is already met there.
4. Redirected authors: `find_author` follows `/type/redirect` records. A wider search, by alternate
   name or surname, can reach more redirects, and the same walk must apply to each step.
5. Input with only `date`, with one of the two dates, or with none: the proposal says the name path
   falls back to name-only matching, and the other two paths do not run.
6. Organisations (`entity_type` of `org`) take the early branch and never reach date logic.

### Rules and their owners

- **Which dates match**: owned by `author_dates_match` and `pick_from_matches`. The proposal wants a
  stricter rule, "exact year for both", on two new paths. Copying the year comparison would
  duplicate a rule: see the one-home-per-rule principle of the Uraeda code-quality guide.
  `author_dates_match` uses `re_year` from the same module.
- **Pattern semantics (`*`, `_`, case)**: owned by `dbstore.py` in production, copied by
  `filter_index` in the mock. `regex_ilike` is a third expression of the same rule.

### Likely changes

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author` takes the author dict
  and runs the three searches. `find_entity` delegates. Date comparison helpers are added.
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): add
  `MockSite.regex_ilike(pattern, text)`. `filter_index` uses it for `~`.
- [`utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): a year helper, with option A of
  [the date rule](#which-dates-must-match).
- Tests in `test_load_book.py`, `test_add_book.py`, and `test_mock_infobase.py`.
- With option B of [the production operator](#production-matching-and-the-mock): a change to the
  `vendor/infogami` submodule.

## The proposal

### There is no surname to match on

The proposal says "match on surname combined with birth and death dates". Author records store no
surname, and the import dictionary has none: only `name`, `personal_name`, `title`, and dates. A
surname has to be derived from the name, and several derivations exist (last word, the part before a
comma in "Smith, John", a particle such as "van" or "de").

### "Exact match when dates are available" contradicts "requires both"

Two bullets cover `alternate_names`. One says the match "requires both `birth_date` and `death_date`
to be present in the input and to exactly match the candidate's values when dates are available".
The other, for surname, says both dates "must exactly match the candidate's values". It is unclear
whether a candidate with no dates may match through `alternate_names`.

### Name matching is also meant to be case-insensitive in production

The requirement says matching "must be case-insensitive" and "different casings must resolve to the
same record". With the vendored operator being case-sensitive `LIKE`, the real database would not
behave this way unless the query changes.

### `find_author` returns "candidate author records"

The proposal says `find_author(author: dict)` returns "a list of candidate author records consistent
with the matching rules". It does not say whether the list holds the candidates of the first
successful step only, or of all steps. `find_entity` "returns either an existing record or `None`".

### Wildcard in the input name

"`John*` must return the first candidate according to numeric key ordering." The mock sorts keys as
text, so `OL10A` sorts before `OL2A`. `key_int` orders them numerically.

## Worth it and feasibility

Small feature: one function, one mock method, and tests. The cost is low and the proposal's problem
(duplicate authors) is real. The risk is in the surname step: matching on the last word of a name
with only the dates as a guard could merge two different people who share a surname and years. Dates
must both match exactly, which keeps that rare.

Outside behaviour relied on:

- Production `ILIKE` behaviour: the vendored code uses `LIKE`. Unverified for the live database. The
  plan's first task would check how `things` queries reach PostgreSQL.
- No security guard is relaxed.

## Approaches

Criteria come from the [proposal](proposal.md) and the [constitution](../CONSTITUTION.md): keep
every requirement and interface as written, add no feature the proposal does not ask for, test the
scenarios, and follow the repository's patterns. There are no decisions yet.

### What surname means

Relies on [there is no surname to match on](#there-is-no-surname-to-match-on).

| Option                                                    | Matches the proposal | Extra code | Risk of wrong merge |
| --------------------------------------------------------- | -------------------- | ---------- | ------------------- |
| A. Last word of the name, query names ending in that word | Yes                  | Small      | Low, dates required |
| B. Last word, with particles such as "van" and "de" kept  | Yes                  | Medium     | Low                 |
| C. Skip the surname step                                  | No, drops a rule     | None       | None                |

### Dates on `alternate_names` and surname

Relies on
[the contradiction in the date wording](#exact-match-when-dates-are-available-contradicts-requires-both).

| Option                                                          | Matches the proposal | Wrong-merge risk |
| --------------------------------------------------------------- | -------------------- | ---------------- |
| A. Candidate must have both dates, equal in year, on both paths | Yes, strict reading  | Lowest           |
| B. `alternate_names` also accepts a candidate with no dates     | Yes, loose reading   | Higher           |

### Which dates must match

Relies on [`author_dates_match`](#important-reads) being permissive.

| Option                                                                                         | One home per rule | Changes the name path |
| ---------------------------------------------------------------------------------------------- | ----------------- | --------------------- |
| A. New year-only helper in `catalog/utils`, used by the two new paths and to rank name matches | Yes               | Ranking only          |
| B. Reuse `author_dates_match` everywhere                                                       | Yes               | None, but too loose   |

### Production matching and the mock

Relies on [the vendored operator](#the-query-operator-in-the-vendored-infobase).

| Option                                                                          | Case-insensitive in production | Touches the submodule |
| ------------------------------------------------------------------------------- | ------------------------------ | --------------------- |
| A. Query with `~`, make the mock follow ILIKE as asked, name the production gap | Unverified                     | No                    |
| B. Also change `dbstore.py` in the infogami submodule to `ILIKE`                | Yes                            | Yes                   |
| C. Compare case-insensitively in Python after a broader query                   | Yes                            | No                    |

### What `_` means in the mock

Relies on [underscore in patterns](#underscore-in-patterns).

| Option                                         | Matches production escaping | Matches the wording "ignored" |
| ---------------------------------------------- | --------------------------- | ----------------------------- |
| A. `_` is a literal underscore, not a wildcard | Yes                         | Partly                        |
| B. `_` is removed from the pattern             | No                          | Yes                           |

### Needs no choice

- **Wildcard `John*` and ordering**: `find_author` takes the lowest `key_int`, and no match returns
  `None` so `import_author` keeps the input name, `*` included.
- **Redirects**: the redirect walk applies to every step's results.
- **Organisations**: the `entity_type` branch is unchanged.

## Not checked

- How the production database receives the `things` query: the infobase server is outside this
  repository, and its code was not available beyond the vendored submodule.
- Online sources: not consulted, as the proposal's constraints forbid looking up existing solutions.
