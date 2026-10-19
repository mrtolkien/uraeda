---
status: auto-approved
spec-revision: 1
---

# Plan: Match authors on alternate_names/surname with birth/death date

**Goal:** An imported author resolves to an existing record by name, then `alternate_names`, then
surname, case-insensitively, with the birth and death year rules of the spec.

**Architecture:** The [spec's architecture](spec.md#architecture) holds. `MockSite.regex_ilike` owns
the `~` matching of the mock. In [`load_book.py`](/openlibrary/catalog/add_book/load_book.py),
`find_author(author: dict)` owns the step order, the year gate, and redirect following.
`find_entity` owns the person/org split and the choice among candidates, through
`pick_from_matches`. `author_dates_match` stays the owner of the name step's date check.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A record with only one date, or none, in the later steps** is not a match, even when the import
   has both dates. Task 2.
2. **A name step whose matches all fail the year check** falls through to the alternate-name step,
   not to a new author. Task 2.
3. **The same record found by two name forms** ("Smith, John" and "John Smith") appears once.
   Task 2.
4. **A `*` in the surname** or an empty name does not crash the surname step. Task 2.
5. **Existing `~` callers** (`key~`, `name~` prefix queries) keep working once the mock matches the
   full string. Task 1.

## Global constraints

- Matching is case-insensitive, and `*` in an import name matches any run of characters (proposal,
  spec US4).
- The alternate-name and surname steps need both import dates present, and both years equal to the
  record's. A record without both dates never matches them (spec, Assumptions).
- The name step compares dates with the existing `author_dates_match` only when the import has both
  dates; otherwise the name alone decides (spec, US1 and Edge cases).
- Among several matches, a record with both years equal wins, else the lowest `key_int` order (spec,
  Architecture).
- For an `entity_type` that is not `person`, the first name match is returned with no date check, as
  today.
- An unmatched import builds the new author with `name`, `birth_date` and `death_date` unchanged:
  `import_author`'s behaviour stays.
- `infogami` (`vendor/infogami`) is not edited.

## Code read

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(name)` queries `name`
  by equality and follows redirects; `find_entity` is its only caller. It flips `Last, First`,
  rejects on birth-date presence, then calls `author_dates_match` and `pick_from_matches` (lowest
  `key_int`).
- [`catalog/utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): `author_dates_match`,
  `flip_name`, `key_int`, and `re_year` (`\b(\d{4})\b`).
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `filter_index`'s `~` is a
  case-sensitive prefix match. Other `~` users: `key~` and `name~` in
  [`openlibrary/plugins`](/openlibrary/plugins/openlibrary/code.py), all with a trailing `*`.
- Tests: `mock_site` fixture ([`conftest.py`](/openlibrary/conftest.py));
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py);
  [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py);
  [`test_add_book.py`](/openlibrary/catalog/add_book/tests/test_add_book.py) `test_extra_author`.
- Validation: `python -m pytest openlibrary/catalog openlibrary/mocks openlibrary/plugins -q`
  (baseline for `catalog` and `mocks`: 269 passed, 1 xfailed), `ruff check`, `black --check`.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None. `regex_ilike` is the interface the proposal names; the year-equality helper is private to
`load_book.py` and serves two steps.

## Test map

Integration tests run through `find_entity` on the `mock_site` fixture with authors saved by
`mock_site.save`; the mock test calls `regex_ilike` directly.

| Spec item                           | Task | Test                                                                                                 |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| SC-004 mock parity                  | 1    | `test_regex_ilike`, `test_things_tilde_matches_alternate_names`                                      |
| Review focus 5                      | 1    | existing `test_things`, `key~` assertions                                                            |
| US1 scenarios 1–3, SC-001           | 2    | `test_name_match_ignores_case`, `test_dates_pick_record`, `test_undated_import_matches_dated_author` |
| US1 more 1 (flipped name)           | 2    | `test_flipped_name_is_searched`                                                                      |
| US1 more 2 (one date only)          | 2    | `test_one_import_date_matches_on_name`                                                               |
| US1 more 3 (key order)              | 2    | `test_lowest_numeric_key_wins`                                                                       |
| US1 more 4 (org)                    | 2    | `test_org_returns_first_match`                                                                       |
| US2 scenarios 1–3, SC-003           | 2    | `test_alternate_name_match`, `..._year_mismatch`, `..._one_date`                                     |
| US3 scenarios 1–3, SC-003           | 2    | `test_surname_match`, `..._year_mismatch`, `..._no_dates`                                            |
| SC-002 priority                     | 2    | `test_name_beats_alternate_name_beats_surname`                                                       |
| US4 scenario 1 (wildcard)           | 2    | `test_wildcard_returns_lowest_key`                                                                   |
| US4 scenario 2, SC-005 (new author) | 2    | `test_unmatched_import_keeps_fields`                                                                 |
| Edge: redirect                      | 2    | `test_redirect_is_followed`                                                                          |
| Review focus 1                      | 2    | `test_later_steps_need_record_dates`                                                                 |
| Review focus 2                      | 2    | `test_year_mismatch_falls_through_to_alternate_name`                                                 |
| Review focus 3                      | 2    | `test_same_record_found_twice_is_one_candidate`                                                      |
| Review focus 4                      | 2    | `test_surname_step_with_star_or_empty_name`                                                          |
| Edge: `_` ignored                   | 1    | `test_regex_ilike`                                                                                   |

## Waves

1. Wave 1: Task 1 (mock).
2. Wave 2: Task 2 (search). It consumes `regex_ilike` through the mock's `~`, so it follows Task 1.

---

## Task 1: Case-insensitive full-string `~` in the mock

**Files:**

- Modify: `openlibrary/mocks/mock_infobase.py` (`MockSite`, `filter_index`)
- Test: `openlibrary/mocks/tests/test_mock_infobase.py`

**Interfaces:**

- Consumes: nothing.
- Produces: `MockSite.regex_ilike(self, pattern: str, text: str) -> bool`: full-string,
  case-insensitive match; `*` is any run of characters, `_` is removed from the pattern, every other
  character is literal. The `~` filter calls it. It no longer means "starts with": a pattern without
  `*` must equal the text.

- [x] **Step 1: Write the failing tests**

In `TestMockSite`: `test_regex_ilike` asserts `regex_ilike("john*", "John Smith")`,
`regex_ilike("JOHN SMITH", "john smith")`, `not regex_ilike("john", "john smith")` (full string),
`regex_ilike("jo_hn", "john")` (`_` ignored), `regex_ilike("a.c", "a.c")` and
`not regex_ilike("a.c", "abc")` (regex characters literal), `regex_ilike("*smith", "John Smith")`.
`test_things_tilde_matches_alternate_names` saves an author with
`alternate_names: ["Mark Twain", "S. Clemens"]` and asserts
`things({"type": "/type/author", "alternate_names~": "mark twain"})` returns its key, and
`"clemens"` returns `[]`.

The break each test catches:

- Full-string: a prefix match that returns "john smith" for "john".
- Literal regex characters: a pattern built without `re.escape`.
- List values: an index that does not hold each element of `alternate_names`. If this fails after
  `regex_ilike` is in, extend `filter_index` so a `~` on a list-valued field tests each element.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/mocks/tests/test_mock_infobase.py -q`
- Expected: FAIL, `AttributeError: 'MockSite' object has no attribute 'regex_ilike'`

- [x] **Step 3: Implement `regex_ilike` and use it in the `~` operation**

Build the regex by escaping each literal chunk and joining chunks with `.*`; match with
`re.fullmatch` and `re.IGNORECASE | re.DOTALL`. Keep the `isinstance(i.value, str)` guard in the `~`
lambda.

- [x] **Step 4: Run the project's validation**

- Run:
  `python -m pytest openlibrary/mocks openlibrary/catalog openlibrary/plugins -q && ruff check openlibrary/mocks && black --check openlibrary/mocks`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/mocks specs/2026-10-19-openlibrary-author-matching
git commit -m "feat(openlibrary-author-matching): case-insensitive full-string ~ in the mock"
```

## Task 2: Three-step author search

**Risky:** Changes which authors imports link to, a rule every import shares, and reverses the
undated-import rejection.

**Files:**

- Modify: `openlibrary/catalog/add_book/load_book.py` (`find_author`, `find_entity`,
  `pick_from_matches`)
- Test: `openlibrary/catalog/add_book/tests/test_load_book.py`

**Interfaces:**

- Consumes: `~` of the mock from Task 1 (`{'type': '/type/author', 'name~': pattern}`); `flip_name`,
  `author_dates_match`, `key_int`, `re_year` from `openlibrary.catalog.utils`.
- Produces: `find_author(author: dict) -> list`: the candidates of the first step that finds any
  (steps and rules per the spec's US1–US3), redirects followed, deduplicated by key. For a
  non-person `entity_type` it returns the name step's matches with no date check and runs no other
  step. `find_entity(author: dict) -> dict | None` is unchanged in signature. `pick_from_matches`
  now prefers a record whose birth and death years both equal the import's, else the lowest
  `key_int`; its `date` handling stays.

- [x] **Step 1: Write the failing tests, and the helpers they use**

In `test_load_book.py`, with a helper `save_author(mock_site, name, key_n, **fields)` and a call
helper `found(author)` returning the key or `None` from `find_entity`. Tests (names in the Test
map), with the spec's values: "John Smith" 1900–1970 found for "john smith"/"1900"/"1970"; 1950–2000
record chosen for "JOHN SMITH" 1950/2000; undated "john smith" finds the dated record; "Smith, John"
found for "John Smith"; "Samuel Clemens" (1835–1910, alternate "Mark Twain") found for "mark twain"
1835/1910 and not for 1911 or birth only; "J. Smith" found for 1900/1970, not for 1971 or no dates;
`/authors/OL9A` "John Smith" and `/authors/OL3A` "Johnny Cash" with "John*" gives `/authors/OL3A`;
OL2A vs OL10A gives OL2A; org returns the first match; a redirect to an author is followed; an
unmatched "John*" import through `import_author` keeps name "John*" and both dates.

The break each test catches:

- Case: an equality query that misses "john smith".
- Year gate: a surname or alternate-name step that ignores a differing death year, or accepts a
  missing date.
- Priority: a surname hit returned while a name hit exists.
- Numeric order: sorting keys as strings (OL10A before OL2A).
- Review focus 2: a name step that returns an empty result instead of falling through.
- Review focus 3: a duplicated candidate that makes `pick_from_matches` see two records.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/catalog/add_book/tests/test_load_book.py -q`
- Expected: FAIL, the first being `test_name_match_ignores_case` returning `None`.

- [x] **Step 3: Implement the search in `load_book.py`**

`find_author(author)`: name step with the name and, when it holds `, `, its flipped form; each
pattern is queried with `name~`, redirects followed, deduplicated by key. In the name step, keep a
candidate unless the import has both dates (or a `date`) and `author_dates_match` rejects it. If
non-empty, return it; for a non-person `entity_type`, return the unfiltered name matches and stop.
Alternate-name step: only when both import dates are present, query `alternate_names~` with the same
patterns, keep records whose birth and death years both equal the import's. Surname step: same gate;
the surname is the last word of `flip_name(name)`, queried as `name~: '*' + surname`; skip when
there is none. Year equality compares `re_year` years and is false when either side lacks one.
`find_entity` keeps the org branch (`things[0]`), otherwise returns the single candidate or
`pick_from_matches(author, candidates)`, and drops its own birth-date presence checks. Update
`pick_from_matches` as the Interfaces say.

- [x] **Step 4: Run the project's validation**

- Run:
  `python -m pytest openlibrary/catalog openlibrary/mocks openlibrary/plugins -q && ruff check openlibrary && black --check openlibrary/catalog openlibrary/mocks`
- Expected: PASS. An existing test that asserted the old rejection of an undated import by a dated
  author is updated to the spec's rule, with a ruling.

- [x] **Step 5: Commit**

```bash
git add openlibrary/catalog specs/2026-10-19-openlibrary-author-matching
git commit -m "feat(openlibrary-author-matching): search authors by name, alternate name, then surname"
```
