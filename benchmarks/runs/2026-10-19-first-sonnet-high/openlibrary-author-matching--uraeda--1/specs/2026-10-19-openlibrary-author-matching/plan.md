---
status: auto-approved
spec-revision: 1
---

# Plan: Match authors on alternate names and surname with birth and death dates

**Goal:** `find_entity` finds an existing author by name, then alternate name, then surname, each
guarded by dates and case-insensitive, and the mock database behaves like `ILIKE`.

**Architecture:** Three owners, as in the [spec's architecture](spec.md#architecture).
`openlibrary/catalog/utils/__init__.py` owns the exact-year rule, as one new function used by the
searches and by the pick. `openlibrary/mocks/mock_infobase.py` owns the mock's pattern rules
(`MockSite.regex_ilike`), and `filter_index` calls it for `~`.
`openlibrary/catalog/add_book/load_book.py` owns the order of the searches:
`find_author(author: dict)` returns the candidates of the first search that finds any, and
`find_entity` delegates to it and picks one with `pick_from_matches`. All three searches use the `~`
query operator. No stored data changes.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **An input date such as "c. 20" (no four-digit year)**, on a dated import, never counts as an
   exact year match, on the two new searches and in the pick. A candidate whose death_date is "20"
   must lose to one whose year is 2010. Task 1 (the rule) and task 3 (the pick).
2. **A redirected author found by alternate name or surname** is followed to its target, as for the
   name search. Task 3.
3. **A name search that finds an author whose dates disagree, then an alternate-name match**: the
   import falls through to the alternate name instead of returning `None`. Task 3.
4. **An organisation** (`entity_type` of `org`) still returns the first name match, with no date
   check and no flipped name. Task 3.
5. **Existing `key~` queries**, which all end in `*` (see Code read), return the same keys. Task 2.

## Global constraints

- "Mock query behavior must replicate production ILIKE semantics, with case-insensitive full-string
  matching, `*` treated as a multi-character wildcard, and `_` ignored in patterns." Answered in Q4
  of the [clarifications](clarifications-01.md): `_` is an ordinary character that matches itself.
- `find_author(author: dict)` takes the import dictionary and returns a list of candidates;
  `find_entity(author: dict)` delegates to it and returns an existing record or `None`.
  `MockSite.regex_ilike(self, pattern: str, text: str) -> bool`.
- Priority: name (with the flipped name), then `alternate_names`, then surname. A name match is
  never mixed with a weaker one.
- The two new searches run only when both input dates are present, and the candidate must have both
  dates with equal four-digit years. The name search keeps today's date filter when both input dates
  are given, and drops it when either is missing.
- With equal candidates, the lowest numeric key (`key_int`) wins; an exact year match on both dates
  outranks other matches.
- Surname is the last word of the input name, queried as `"* " + surname`; a one-word name skips the
  search.
- Preserved: the organisation branch of `find_entity`; redirects are followed for every search;
  `import_author` keeps name and dates when nothing is found; the existing tests of
  `test_add_book.py`, `test_load_book.py`, and `test_mock_infobase.py` pass unchanged (SC-003).
- Follow the surrounding style: small module-level functions with docstrings and type hints.
  Validation: `python -m pytest openlibrary/catalog openlibrary/mocks openlibrary/tests/catalog -q`,
  `ruff check` on the changed files.

## Code read

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py): `find_author(name)` is called only
  by `find_entity`; `find_entity` is called by `import_author` and, in tests, stubbed by
  `monkeypatch.setattr(load_book, 'find_entity', ...)` in
  [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py). So changing
  `find_author`'s parameter breaks no other caller.
- [`utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): `author_dates_match`, `re_year`,
  `key_int`. Tests in
  [`openlibrary/tests/catalog/test_utils.py`](/openlibrary/tests/catalog/test_utils.py).
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `things` and `filter_index`; the `~`
  lambda is the only prefix match. Every `key~` caller in the repository ends its value with `*`
  ([`code.py:130`](/openlibrary/plugins/openlibrary/code.py), `upstream/utils.py:243`,
  `upstream/code.py:198`, `catalog/utils/query.py:59`). Tests in
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py), using the `mock_site`
  fixture.
- [`test_add_book.py`](/openlibrary/catalog/add_book/tests/test_add_book.py) exercises authors
  through `mock_site`: the right place to seed authors and call `find_entity`.
- [`dbstore.py` lines 293-295](/vendor/infogami/infogami/infobase/dbstore.py): `~` becomes `LIKE`.
- Baseline before any change: `python -m pytest openlibrary/catalog openlibrary/mocks -q` gives 146
  passed, 1 xfailed.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

- **`author_years_match_exactly`** (new function, task 1): serves the two new searches and the pick,
  so the year rule has one home (SC-001). Rejected: reusing `author_dates_match`, which is
  permissive.
- **`MockSite.regex_ilike`** (new method, task 2): named by the proposal's interface.
- **`find_author` split into small helpers** (task 3): one search-by-pattern function holds the
  redirect walk for all three searches. Rejected: three copies of the walk.

No unit grows past a limit: `find_author` and `find_entity` are replaced by shorter units.

## Test map

Integration tests run `find_entity` on `mock_site` (the in-memory `MockSite`), seeding authors with
`mock_site.save`. No clock is involved.

| Spec item                   | Task | Test                                                 |
| --------------------------- | ---- | ---------------------------------------------------- |
| US1 scenarios 1-4, more 1-3 | 3    | `TestFindEntity.test_name_*` in `test_add_book.py`   |
| US2 scenarios 1-3, more 1-3 | 3    | `TestFindEntity.test_alternate_name_*`               |
| US3 scenarios 1-3, more 1-2 | 3    | `TestFindEntity.test_surname_*`                      |
| US4 scenarios 1-3           | 2    | `test_regex_ilike` (parametrized)                    |
| US4 more 1, SC-004          | 2    | `test_things_key_prefix_star_unchanged`              |
| SC-001, edge "c. 20"        | 1    | `test_author_years_match_exactly`                    |
| SC-002                      | 3    | all of the above run against `MockSite`              |
| SC-003                      | 3    | existing test files, unchanged                       |
| Edge: nothing matches       | 3    | `TestFindEntity.test_nothing_found`                  |
| Edge: redirect              | 3    | Review focus: `TestFindEntity.test_follows_redirect` |
| Edge: found twice           | 3    | `TestFindEntity.test_same_author_two_spellings`      |
| Edge: `_` and middle `*`    | 2    | `test_regex_ilike`                                   |
| Edge: not a person          | 3    | Review focus: `TestFindEntity.test_org_unchanged`    |
| Review focus: "c. 20"       | 1, 3 | `test_author_years_match_exactly`, US1 scenario 2    |
| Review focus: fall through  | 3    | US2 more scenario 3                                  |

## Waves

1. Tasks 1 and 2: different files (`catalog/utils` and `mocks`), no shared file.
2. Task 3: consumes both.

---

## Task 1: The exact-year rule and the outside check

**Files:**

- Modify: `openlibrary/catalog/utils/__init__.py` (next to `author_dates_match`)
- Test: `openlibrary/tests/catalog/test_utils.py`

**Interfaces:**

- Consumes: `re_year`.
- Produces: `author_years_match_exactly(a: dict, b: dict) -> bool`: true when both records have a
  `birth_date` and a `death_date`, each holds a four-digit year, and the years are equal.

- [x] **Step 1: Check the outside behaviour the spec marks unverified**

Read how `things` reaches PostgreSQL:
`grep -rn "ILIKE\|LIKE" vendor/infogami/infogami/infobase/dbstore.py`. Expected: `LIKE` only, so
live case-insensitivity is not provided here. The spec's assumption already accepts this (Q3, option
A): record it as ruling R1, and go on.

- [x] **Step 2: Write the failing test**

`test_author_years_match_exactly`: equal years in different forms ("1770" and "c. 1770") match;
different death year does not; a missing birth_date or death_date on either side does not; "20"
against "20" does not (no four-digit year).

The break it catches: a rule that falls back to string equality or prefix, like
`author_dates_match`.

- [x] **Step 3: Run it to check it fails**

- Run: `python -m pytest openlibrary/tests/catalog/test_utils.py -q -k exactly`
- Expected: FAIL, `ImportError: cannot import name 'author_years_match_exactly'`

- [x] **Step 4: Implement `author_years_match_exactly`** with the contract above.

- [x] **Step 5: Run the validation**

- Run: `python -m pytest openlibrary/tests/catalog -q && ruff check openlibrary/catalog/utils`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add openlibrary/catalog/utils/__init__.py openlibrary/tests/catalog/test_utils.py specs/2026-10-19-openlibrary-author-matching
git commit -m "feat(openlibrary-author-matching): add the exact-year rule"
```

## Task 2: The mock follows ILIKE

**Files:**

- Modify: `openlibrary/mocks/mock_infobase.py` (`MockSite`, `filter_index`)
- Test: `openlibrary/mocks/tests/test_mock_infobase.py`

**Interfaces:**

- Consumes: nothing.
- Produces: `MockSite.regex_ilike(self, pattern: str, text: str) -> bool`: whole text matches,
  ignoring case; `*` matches any characters; every other character, `_` included, matches itself.
  The `~` operator of `things` uses it.

- [x] **Step 1: Write the failing tests**

`test_regex_ilike`, parametrized: ("john\*", "John Smith") true; ("john", "John Smith") false;
("a_b", "A_B") true; ("a_b", "axb") false; ("j\*n S\*h", "John Smith") true; ("a.b", "axb") false.
`test_things_key_prefix_star_unchanged`: `{"key~": "/books/*"}` returns the same keys as today, and
`"/works/*"` returns none (the existing assertions, kept). Add
`test_things_name_is_case_insensitive`: `{"name~": "john*"}` finds "John Smith".

Breaks caught: a prefix match (the second and last cases of `john`), a regex built without escaping
(`a.b`), `_` treated as a wildcard.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/mocks/tests/test_mock_infobase.py -q`
- Expected: FAIL, `AttributeError: 'MockSite' object has no attribute 'regex_ilike'`

- [x] **Step 3: Implement `regex_ilike`** and switch the `~` lambda to it.

- [x] **Step 4: Run the validation**

- Run: `python -m pytest openlibrary/mocks openlibrary/catalog -q && ruff check openlibrary/mocks`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/mocks specs/2026-10-19-openlibrary-author-matching
git commit -m "feat(openlibrary-author-matching): make the mock ~ operator follow ILIKE"
```

## Task 3: Author search in three steps

**Risky:** changes a rule `import_author` relies on for every imported author: a wrong merge links a
work to the wrong person.

**Files:**

- Modify: `openlibrary/catalog/add_book/load_book.py` (`find_author`, `find_entity`,
  `pick_from_matches`)
- Test: `openlibrary/catalog/add_book/tests/test_add_book.py`

**Interfaces:**

- Consumes: `author_years_match_exactly` (task 1), the case-insensitive `~` of the mock (task 2),
  `author_dates_match`, `key_int`, `flip_name`.
- Produces: `find_author(author: dict) -> list` (candidates of the first search that finds any; an
  organisation gets the exact-name matches only); `find_entity` unchanged in signature;
  `pick_from_matches` prefers candidates with an exact year match on both dates when the input has
  both dates, then keeps its current rules.

Algorithm that correctness depends on:

1. Name search: query `{'type': '/type/author', 'name~': name}`, plus the same for `flip_name(name)`
   when the name holds ", ". Follow redirects, drop duplicate keys. With both input dates, keep only
   candidates that pass today's filter: skip a candidate lacking `birth_date`, and apply
   `author_dates_match`. With either date missing, keep all. Return them if any.
2. Both input dates are required beyond this point. Alternate names: query `alternate_names~: name`,
   keep candidates with `author_years_match_exactly`. Return them if any.
3. Surname: skip a one-word name; query `name~: "* " + last word`, same filter.
4. Otherwise `[]`.

- [x] **Step 1: Write the failing tests**

One test per scenario of US1 to US3, plus the review-focus and edge tests of the test map. Seed with
`mock_site.save`
(`{'key': '/authors/OL1A', 'type': {'key': '/type/author'}, 'name': ..., 'birth_date': ..., 'death_date': ..., 'alternate_names': [...]}`)
and call `find_entity(dict)`; assert the returned key or `None`. Exact values from the spec.

Breaks caught: a name match mixed with weaker ones (US2 more 3); lowest text key chosen, so OL10A
beats OL2A (US1 scenario 4); an undated candidate accepted through the alternate name (US2 more 2);
"Blacksmith" matching "Smith" (US3 more 1); a one-word name reaching the surname search (US3 more
2).

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest openlibrary/catalog/add_book/tests/test_add_book.py -q -k find_entity`
- Expected: FAIL, the first is `test_find_entity_name_case_insensitive`:
  `assert None == '/authors/OL1A'`

- [x] **Step 3: Implement** `find_author`, `find_entity`, and `pick_from_matches` as above, with one
      helper that runs a pattern query and walks redirects.

- [x] **Step 4: Run the validation**

- Run:
  `python -m pytest openlibrary/catalog openlibrary/mocks openlibrary/tests/catalog -q && ruff check openlibrary/catalog openlibrary/mocks`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add openlibrary/catalog/add_book specs/2026-10-19-openlibrary-author-matching
git commit -m "feat(openlibrary-author-matching): find authors by alternate name and surname"
```
