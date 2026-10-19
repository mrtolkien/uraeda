---
status: auto-approved
spec-revision: 3
---

# Plan: Match authors on alternate names and surname with birth and death dates

**Goal:** imports link each author to the existing Open Library author found by name, then alternate
name, then surname, ignoring case, with birth and death years telling same-name people apart.

**Architecture:** two owners, as the [spec's architecture](spec.md#architecture) sets them.
`MockSite.regex_ilike` in [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py) owns the mock's
`~` semantics, and the `~` entry of `MockSite.filter_index` delegates to it, so every `~` query of
every test goes through one rule. `find_author(author)` in
[`load_book.py`](/openlibrary/catalog/add_book/load_book.py) owns the matching rules: the queries,
the steps, the year checks, and the order of candidates. `find_entity(author)` only takes its first
candidate, and `import_author` keeps the death-date fill-in and the new-candidate path unchanged.

`find_author` runs its queries once and filters their results step by step: the name queries (the
name, and the flipped name for a person) feed steps 1 and 2; the alternate-name queries feed step 3;
the surname query feeds step 4. A query runs only when the step that needs it is reached, so an
import matched at step 1 runs one or two queries, and none runs more than five. The exact-year rule
is one private helper in `load_book.py`, used by steps 1, 3, and 4, and by the ordering of the
single step. `author_dates_match` stays as it is, used by step 2 only. Infogami is not touched:
production's `~` stays a case-sensitive `LIKE`, recorded in the inbox.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **Names holding regular-expression characters**, like "J. R. R. Tolkien" or "Smith (John)", match
   literally in the mock and never raise: "J.R.R." does not fit "JxRxRx". Task 1.
2. **The existing `~` prefix queries**, like `key~ "/books/*"`, keep their results, and a `~`
   pattern without `*` now fits only the whole value: `key~ "/books/OL1"` no longer finds
   `/books/OL1M`. Every `~` query in the code ends with `*` ([Code read](#code-read)). Task 1.
3. **A candidate found by two queries of one step**, like an author whose alternate names hold both
   "Bruar, Henry" and "Henry Bruar", is returned once. Task 2.
4. **An import's date that is present but empty**, like `"death_date": ""` or `None`, counts as
   absent: the import takes the single name step, as one without that date. Task 2.

## Global constraints

From [the spec](spec.md), word for word. Every task's requirements include these.

- `find_author(author)` "takes the import's author dict and returns the matching stored authors,
  best first. It owns the matching rules. It runs the steps below in order, and returns the
  candidates of the first step that keeps any, sorted by numeric key, after following redirects:
  1. The name and, for "Surname, Forename", its flipped form, with both years exact.
  2. The same names with today's tolerant date rule, `author_dates_match`, on a candidate that has a
     birth date: a missing death date passes.
  3. The same names among `alternate_names`, on a candidate with both years exact.
  4. The surname, on a candidate with both years exact."
- "Steps 1 to 4 run only when the import has both dates and is a person. Otherwise there is a single
  step, the name and its flipped form alone. Candidates with the import's one year come first, then
  the others, each group by key. An organization uses the name alone, without its flipped form."
- "`find_entity(author)` returns the first candidate of `find_author`, or `None`. The death-date
  fill-in and the new-candidate path stay in `import_author`, unchanged."
- "The exact-year check is a private helper in `load_book.py`. It owns the year rule: both sides
  have a four-digit year, found with `re_year`, and they are equal. `author_dates_match` stays as it
  is."
- "The surname is a private helper: the text before the first ", " of the import's name, or else its
  last word. It is matched with the pattern `* <surname>`, so it fits stored names ending with a
  space and the surname."
- "`MockSite.regex_ilike(pattern, text)` ... returns whether the whole `text` fits `pattern`,
  ignoring case. It first removes every `_` from `pattern`, then `*` matches any run of characters,
  and every other character is literal. The mock's `~` filter uses it."
- "A note in `specs/INBOX.md` records that production's `~` stays a case-sensitive `LIKE` until
  infogami does `ILIKE`."
- SC-002: "every existing test passes, including the mock's `key~` prefix queries in
  `test_mock_infobase.py`."
- SC-004: "an imported person runs at most five author queries."
- From the [assumptions](spec.md#assumptions): "The surname step uses the import's `name`, not
  `personal_name`"; "The import's one year, when it has only one, orders the name candidates but
  never removes one"; "With both dates, a same-name author without any date matches no step".

Existing behaviour to preserve:

- An import with `entity_type` other than `person` is an organization; an import without
  `entity_type` is a person. Today's test is `et and et != 'person'` in
  [`find_entity`](/openlibrary/catalog/add_book/load_book.py).
- `import_author` fills a matched author's missing `death_date` from the import, and otherwise
  returns a new candidate with `name`, `title`, `personal_name`, `birth_date`, `death_date`, and
  `date` copied unchanged, after `do_flip`. Covered by the name-order tests of
  [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) and the author tests
  of [`test_add_book.py`](/openlibrary/catalog/add_book/tests/test_add_book.py).
- `author_dates_match` is unchanged, with its tests in
  [`test_utils.py`](/openlibrary/tests/catalog/test_utils.py).
- Ruff's limits in [`pyproject.toml`](/pyproject.toml): complexity 28, 23 branches, 70 statements,
  15 arguments, 14 returns per function. Black formatting, with `skip-string-normalization`.

## Code read

- [`load_book.py`](/openlibrary/catalog/add_book/load_book.py), 300 lines: `find_author(name)`
  queries `{'type': '/type/author', 'name': name}` with `=`, then walks redirects. `find_entity`
  adds the flipped name, filters with `author_dates_match` and the birth-date presence checks, and
  ties go to `pick_from_matches`. `find_author` and `pick_from_matches` have no other caller in the
  repository: `find_entity` is the only one. `import_author` is called from `build_query` here and
  twice from [`add_book/__init__.py`](/openlibrary/catalog/add_book/__init__.py).
- [`catalog/utils/__init__.py`](/openlibrary/catalog/utils/__init__.py): `re_year` is `\b(\d{4})\b`,
  `key_int` turns `/authors/OL12A` into 12, `flip_name("Brewer, A.")` gives "A. Brewer"
  (`re_end_dot` only strips a dot after two letters).
- [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py): `things` filters an in-memory index and
  sorts keys as strings, limit 100. `filter_index`'s `~` is
  `isinstance(i.value, str) and i.value.startswith(web.rstrips(value, "*"))`. A list property like
  `alternate_names` is indexed as one entry per element, so `alternate_names~` tests each one.
- Every `~` query in the code ends with `*`: `key~` in
  [`core/models.py`](/openlibrary/core/models.py) (716, 936),
  [`processors/invalidation.py`](/openlibrary/core/processors/invalidation.py) (133),
  [`plugins/openlibrary/code.py`](/openlibrary/plugins/openlibrary/code.py) (130, only for keys
  ending in `*`), [`plugins/upstream/code.py`](/openlibrary/plugins/upstream/code.py) (198);
  `source_records~ "ia:*"` in [`catalog/utils/query.py`](/openlibrary/catalog/utils/query.py);
  `<selector>~ "*"` in [`book_providers.py`](/openlibrary/book_providers.py).
- Tests: pytest, `mock_site` fixture from [`mock_infobase.py`](/openlibrary/mocks/mock_infobase.py),
  which sets `web.ctx.site`.
  [`test_load_book.py`](/openlibrary/catalog/add_book/tests/test_load_book.py) stubs `find_entity`
  with its `new_import` fixture; no test calls `find_entity` itself.
  [`test_mock_infobase.py`](/openlibrary/mocks/tests/test_mock_infobase.py) has `TestMockSite`.
- Validation: `pytest openlibrary/catalog openlibrary/mocks openlibrary/tests/catalog` (395 passed,
  1 xfailed before the change), the whole suite with
  `pytest . --ignore=infogami --ignore=vendor --ignore=node_modules`, `ruff check`, and `mypy` on
  the changed files, which reports 34 errors in 31 other modules before the change, none in these
  files. Black is not installed in this environment.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Abstraction or exception                            | Why it is needed                                                                               | Simpler alternative rejected because                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `MockSite.regex_ilike`                              | The proposal names it, and the `~` filter and its tests share one rule                         | An inline lambda cannot be tested on its own, as SC-003 asks                    |
| `save_author` helper and `authors` fixture in tests | Every scenario seeds the spec's table of stored authors, with extra authors for some scenarios | Saving the dicts inline in each test repeats five authors in about twenty tests |

## Test map

The tests call `find_entity`, `find_author`, or `import_author` directly, on the `mock_site`
fixture, seeded with the spec's stored authors by the `authors` fixture. Keys are compared as
strings, like `"/authors/OL2A"`.

| Spec                                                                | Task | Test                                                                                          |
| ------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| US1 1, 2, more 1, more 4                                            | 2    | `test_load_book.py`, `test_find_entity` parametrized cases                                    |
| US1 3                                                               | 2    | `test_load_book.py`, `test_import_author_new_candidate_keeps_fields`                          |
| US1 more 2                                                          | 2    | `test_load_book.py`, `test_import_author_fills_death_date`                                    |
| US1 more 3                                                          | 2    | `test_load_book.py`, `test_find_author_one_year_orders_candidates`                            |
| US2 1, 2, 3, more 1                                                 | 2    | `test_load_book.py`, `test_find_entity` cases, with extra authors OL8A and OL9A               |
| US3 1, 2, 3, more 1                                                 | 2    | `test_load_book.py`, `test_find_entity` parametrized cases                                    |
| US4 1                                                               | 2    | `test_load_book.py`, `test_find_entity` case "william*"                                       |
| US4 2                                                               | 2    | `test_load_book.py`, `test_import_author_new_candidate_keeps_fields` case "Zed*"              |
| Edge: shared surname and years, several match, dates on stored only | 2    | covered by US3 1, US1 1, US1 2                                                                |
| Edge: a date with no four-digit year                                | 2    | `test_load_book.py`, `test_find_entity_date_without_year`                                     |
| Edge: a name with no space and no ", "                              | 2    | `test_load_book.py`, `test_find_entity_surname_without_space`                                 |
| Edge: a stored date with more than a year                           | 2    | covered by US2 1 and US3 1, through OL3A                                                      |
| Edge: a name holding `_`                                            | 1, 2 | `test_mock_infobase.py` SC-003 cases; `test_load_book.py`, `test_find_entity_underscore_name` |
| Edge: a wildcard over the query limit                               | none | production only: infogami does not sort; the mock sorts all matches                           |
| Edge: a query returns a redirect                                    | 2    | `test_load_book.py`, `test_find_author_follows_redirects_once`                                |
| SC-001                                                              | 2    | every row above in `test_load_book.py`                                                        |
| SC-002                                                              | 1, 2 | the whole suite, including `TestMockSite.test_query`                                          |
| SC-003                                                              | 1    | `test_mock_infobase.py`, `test_regex_ilike` parametrized cases                                |
| SC-004                                                              | 2    | `test_load_book.py`, `test_find_author_runs_at_most_five_queries`                             |
| Review focus: regular-expression characters                         | 1    | `test_mock_infobase.py`, `test_regex_ilike` cases with "." and "("                            |
| Review focus: existing `~` prefix queries                           | 1    | `test_mock_infobase.py`, `test_query` and `test_query_tilde_is_full_case_insensitive`         |
| Review focus: a candidate found by two queries                      | 2    | `test_load_book.py`, `test_find_author_returns_candidate_once`                                |
| Review focus: an empty date                                         | 2    | `test_load_book.py`, `test_find_entity_empty_date_is_absent`                                  |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Task 1: the mock's `~` alone, since every case-insensitive and wildcard test of task 2 relies on
   it.
2. Task 2: the matching rules, built on task 1's `~`.

---

## Task 1: Case-insensitive full-string `~` in the mock site

**Risky:** changes the meaning of `~` for every test that queries the mock, a rule many callers
share.

**Files:**

- Modify: `openlibrary/mocks/mock_infobase.py` (`MockSite.filter_index`, new `MockSite.regex_ilike`)
- Test: `openlibrary/mocks/tests/test_mock_infobase.py`

**Interfaces:**

- Consumes: nothing.
- Produces: `MockSite.regex_ilike(self, pattern: str, text: str) -> bool`, and the mock's `~`
  operator, `{"name~": pattern}`, now true when `regex_ilike(pattern, value)` is, for a string
  value; a list of patterns matches when any one does, as today.

- [x] **Step 1: Write the failing tests**

```python
# openlibrary/mocks/tests/test_mock_infobase.py, in TestMockSite
@pytest.mark.parametrize(
    ("pattern", "text", "expected"),
    [
        ("john*", "John Smith", True),
        ("*smith", "John Smith", True),
        ("Jo_hn", "John", True),
        ("John", "John Smith", False),
        ("J_hn", "John", False),
        ("Foo_Bar", "Foo_Bar", False),
        ("J.R.R. Tolkien", "j.r.r. tolkien", True),
        ("J.R.R.", "JxRxRx", False),
        ("Smith (John", "smith (john", True),
    ],
)
def test_regex_ilike(self, mock_site, pattern, text, expected):
    assert mock_site.regex_ilike(pattern, text) is expected

def test_query_tilde_is_full_case_insensitive(self, mock_site):
    mock_site.save({"key": "/authors/OL1A", "type": {"key": "/type/author"},
                    "name": "John Smith", "alternate_names": ["Jean Smith"]})
    assert mock_site.things({"name~": "JOHN SMITH"}) == ["/authors/OL1A"]
    assert mock_site.things({"name~": "* smith"}) == ["/authors/OL1A"]
    assert mock_site.things({"name~": "John"}) == []
    assert mock_site.things({"alternate_names~": "jean*"}) == ["/authors/OL1A"]
    assert mock_site.things({"key~": "/authors/OL1"}) == []
    assert mock_site.things({"key~": "/authors/*"}) == ["/authors/OL1A"]
```

Add `import pytest` at the top. The break each test catches:

- `regex_ilike` "john*": a case-sensitive match.
- "\*smith": a prefix-only match, as today.
- "Jo_hn" against "John": `_` kept as a literal or a one-character wildcard.
- "John" against "John Smith": a prefix or search match instead of the whole string.
- "J_hn" against "John": `_` read as a one-character wildcard.
- "Foo_Bar" against "Foo_Bar": `_` kept in the pattern instead of removed.
- "J.R.R." against "JxRxRx": `.` left as a regular-expression wildcard.
- "Smith (John": an unescaped `(` that raises `re.error`.
- `test_query_tilde_is_full_case_insensitive`: `filter_index` not using `regex_ilike`, or prefix
  semantics kept for `key~`.

- [x] **Step 2: Run them to check they fail**

- Run: `pytest openlibrary/mocks/tests/test_mock_infobase.py -q`
- Expected: FAIL, `AttributeError: 'MockSite' object has no attribute 'regex_ilike'`, and
  `test_query_tilde_is_full_case_insensitive` failing on `assert [] == ['/authors/OL1A']`.

- [x] **Step 3: Implement `MockSite.regex_ilike` and use it for `~`**

`regex_ilike(pattern, text)` removes every `_` from `pattern`, splits it on `*`, escapes each piece
with `re.escape`, joins them with `.*`, and returns whether `re.fullmatch` of that, with
`re.IGNORECASE | re.DOTALL`, matches `text`. The `~` entry of `filter_index`'s `operations` becomes
`isinstance(i.value, str) and self.regex_ilike(value, i.value)`. Give it a docstring saying it
stands for infogami's `~` as ILIKE, and that the vendored infogami still does a case-sensitive
`LIKE` and keeps `_` literal.

- [x] **Step 4: Run the project's validation**

- Run: `pytest openlibrary/catalog openlibrary/mocks openlibrary/tests/catalog -q`, then
  `pytest . --ignore=infogami --ignore=vendor --ignore=node_modules -q`, then
  `ruff check openlibrary/mocks`
- Expected: PASS, no new failure against the baseline, and ruff "All checks passed!"

- [x] **Step 5: Commit**

```bash
git add openlibrary/mocks/mock_infobase.py openlibrary/mocks/tests/test_mock_infobase.py specs/2026-10-19-openlibrary-author-matching/plan.md
git commit -m "feat(openlibrary-author-matching): case-insensitive full-string ~ in the mock site"
```

## Task 2: Find authors by name, alternate name, then surname, with years

**Risky:** changes which existing author every import links to, a rule shared by the three
`import_author` call sites.

**Files:**

- Modify: `openlibrary/catalog/add_book/load_book.py` (`find_author`, `find_entity`; remove
  `pick_from_matches`, which has no caller left)
- Modify: `specs/INBOX.md` on the default branch (the note on production's `~`)
- Test: `openlibrary/catalog/add_book/tests/test_load_book.py`

**Interfaces:**

- Consumes: the mock's `~` from task 1: `{"name~": pattern}` and `{"alternate_names~": pattern}`
  match the whole value, ignoring case, `*` as any run, `_` removed.
- Produces: `find_author(author: dict) -> list` of stored author things, best first, replacing
  `find_author(name: str)`; `find_entity(author: dict)` returns `find_author(author)[0]` or `None`.

- [x] **Step 1: Write the failing tests, and the helpers they use**

The helper and fixture, at the top of `test_load_book.py`:

```python
def save_author(site, key, name, alternate_names=(), birth_date=None, death_date=None):
    doc = {"key": f"/authors/{key}", "type": {"key": "/type/author"}, "name": name}
    if alternate_names:
        doc["alternate_names"] = list(alternate_names)
    if birth_date:
        doc["birth_date"] = birth_date
    if death_date:
        doc["death_date"] = death_date
    site.save(doc)

@pytest.fixture()
def authors(mock_site):
    save_author(mock_site, "OL2A", "William H. Brewer", birth_date="1829", death_date="1910")
    save_author(mock_site, "OL10A", "William H. Brewer", birth_date="1829", death_date="1910")
    save_author(mock_site, "OL3A", "Harry Brewer", ["Henry Bruar"],
                "September 14th, 1829", "11/2/1910")
    save_author(mock_site, "OL4A", "Anne Brewer", birth_date="1829", death_date="1911")
    save_author(mock_site, "OL5A", "Jo Smith", birth_date="1850")
    return mock_site
```

The tests, with the spec's exact values. `test_find_entity` is parametrized on the import's author
dict and the expected key, or `None`:

| Import                                  | Expected | Spec       |
| --------------------------------------- | -------- | ---------- |
| "WILLIAM H. BREWER", "1829", "1910"     | OL2A     | US1 1      |
| "William H. Brewer", no dates           | OL2A     | US1 2      |
| "Brewer, William H.", "1829", "1910"    | OL2A     | US1 more 1 |
| "Brewer, William H.", no dates          | OL2A     | US1 more 1 |
| "henry bruar", "1829", "1910"           | OL3A     | US2 1      |
| "Henry Bruar", no dates                 | `None`   | US2 2      |
| "Mr. Harry J. Brewer", "1829", "1910"   | OL2A     | US3 1      |
| "Brewer, A.", "1829", "1911"            | OL4A     | US3 2      |
| "Mr. Harry J. Brewer", "1829", no death | `None`   | US3 3      |
| "Mr. Harry J. Brewer", "1829", "1912"   | `None`   | US3 more 1 |
| "william*", no dates                    | OL2A     | US4 1      |

Separate tests, each on the `authors` fixture:

- `test_find_entity_organization`: OL7A "Acme Press" saved;
  `{"name": "ACME PRESS", "entity_type": "org"}` gives OL7A. (US1 more 4)
- `test_find_entity_dateless_same_name_does_not_beat_alternate`: OL8A "Henry Bruar" saved without
  dates; "Henry Bruar" 1829-1910 gives OL3A. (US2 3)
- `test_find_entity_alternate_needs_candidate_years`: a fresh `mock_site` with only OL9A "Hal
  Bruar", alternate "Henry Bruar", no dates; "Henry Bruar" 1829-1910 gives `None`. (US2 more 1)
- `test_find_entity_surname_without_space`: OL14A "Ancient Plato" 1829-1910 saved; "Plato" 1829-1910
  gives OL14A, the surname "Plato" against names ending in " Plato". (edge)
- `test_find_entity_underscore_name`: OL12A "Foo_Bar" saved; "Foo_Bar" with no dates gives `None`,
  the mock's tradeoff the spec records. (edge)
- `test_find_entity_date_without_year`: OL15A "Geoffrey Chaucer" birth "14th cent." death "1400";
  the import with the same two strings gives OL15A, through the tolerant step 2. (edge)
- `test_find_entity_empty_date_is_absent`: "Jo Smith" with `"birth_date": "1851"` and
  `"death_date": ""` gives OL5A by name alone, and with `"death_date": None` too; steps 1 to 4 would
  find nothing, OL5A's birth year being 1850. (review focus 4)
- `test_import_author_new_candidate_keeps_fields`, parametrized: "William H. Brewer" 1829-1912 and
  "Zed*" 1829-1910 each return a dict without `key`, whose `name`, `birth_date`, and `death_date`
  equal the import's. (US1 3, US4 2)
- `test_import_author_fills_death_date`: "Jo Smith" 1850-1900 returns OL5A, with `death_date`
  "1900". (US1 more 2)
- `test_find_author_one_year_orders_candidates`: OL6A "Jo Smith" born "1851" saved; "Jo Smith" born
  "1851" gives `find_author` keys `["/authors/OL6A", "/authors/OL5A"]`, and `find_entity` OL6A. (US1
  more 3)
- `test_find_author_returns_candidate_once`: OL3A saved again with alternate names
  `["Bruar, Henry", "Henry Bruar"]`; "Bruar, Henry" 1829-1910 gives keys `["/authors/OL3A"]`.
  (review focus 3)
- `test_find_author_follows_redirects_once`: OL55A saved as `/type/redirect` to `/authors/OL2A`;
  `monkeypatch` `mock_site.things` to return `["/authors/OL55A", "/authors/OL2A"]`; "William H.
  Brewer" 1829-1910 gives keys `["/authors/OL2A"]`. (edge)
- `test_find_author_runs_at_most_five_queries`: wrap `mock_site.things` with a counter; "Nobody,
  Known" 1829-1910, which no step matches, runs 5 queries; "Nobody, Known" with no dates runs 2.
  (SC-004)

The break each test catches:

- US1 1: an exact `=` query (case-sensitive), or string key order picking OL10A.
- US1 2: today's birth-date presence check, which skips dated authors for an undated import.
- US1 more 1: the flipped name not queried; the case without dates catches it, since with dates the
  surname step finds OL2A anyway.
- US2 1: alternate names not queried, or queried case-sensitively.
- US2 2: alternate names queried without both dates.
- US2 3: step 2 accepting a candidate without a birth date, or steps out of order.
- US2 more 1 and US3 3, more 1: the tolerant date rule used on alternate names or the surname.
- US3 1: the surname matched on a first name, or ordered by name instead of key.
- US3 2: the surname taken as the last word of "Brewer, A." ("A.").
- US4 1 and 2: `*` escaped or stripped, or a new candidate built from the pattern without its `*`.
- Organization: the name lookup dropped for organizations, or made case-sensitive.
- One year ordering: one year used as a filter, dropping OL5A, or ignored, giving OL5A first.
- Fills death date: `find_entity` returning `None` on a missing stored death date (step 2 dropped).
- Date without year: steps 1 to 4 all requiring years, losing today's tolerant match.
- Empty date: `"death_date" in author` used as presence, sending the import to steps 1 to 4.
- Candidate once and redirect: no deduplication by key across queries.
- Five queries: every query run up front for an import without dates, or step 1 queries repeated for
  step 2.
- "Foo_Bar": the lookup bypassing the site's `~` (documents the mock's tradeoff).

- [x] **Step 2: Run them to check they fail**

- Run: `pytest openlibrary/catalog/add_book/tests/test_load_book.py -q`
- Expected: FAIL. The first failure is `test_find_entity` on "WILLIAM H. BREWER":
  `assert None == '/authors/OL2A'`, since the exact `=` query finds nothing. The `find_author` tests
  fail on a `dict` passed as the queried name, which matches nothing. The tests of preserved
  behaviour (dates without a year, redirects, new candidates) already pass.

- [x] **Step 3: Implement `find_author(author: dict) -> list` and `find_entity(author: dict)`**

In `load_book.py`, following the [global constraints](#global-constraints):

- A date is present when the import's value is truthy. "Both dates" means `birth_date` and
  `death_date` present.
- Each query is `{"type": "/type/author", "<field>~": pattern}`, with `field` `name` or
  `alternate_names`, through `web.ctx.site.things`; results are fetched, redirects walked as today,
  and deduplicated by key across the queries of a step.
- The names are the import's `name`, plus `flip_name(name)` when it holds ", " and the import is a
  person.
- With both dates and a person: steps 1 to 4, each returning its candidates sorted by `key_int`. The
  name queries run once for steps 1 and 2; the alternate-name queries only when steps 1 and 2 keep
  nothing; the surname query only when step 3 keeps nothing.
- Otherwise: the name candidates, those whose year agrees with each date the import has first, each
  group by `key_int`.
- The exact-year helper compares the `re_year` years of `birth_date` and `death_date` on both sides,
  false when either side lacks one. The surname helper follows the spec's rule, and the surname step
  is skipped when the name has no word.
- `find_entity` returns the first candidate or `None`; remove `pick_from_matches` and the old
  filtering. Update the docstrings to say what each function owns.

- [x] **Step 4: Add the note to the inbox**

Notes live on the default branch: write it in a checkout of `main` (a worktree at
`.worktrees/main/`), at the end of `specs/INBOX.md`, under a new `## Catalog import` category, and
commit `specs/INBOX.md` alone there, with `chore: add "Production's ~ ..." to the inbox`. The note:

```md
- [agent] [openlibrary-author-matching] Production's ~ is still a case-sensitive LIKE in the
  vendored infogami, with _ literal, so import author matching stays case-sensitive until infogami
  does ILIKE; the surname lookup's leading * has no index to serve it
```

- [x] **Step 5: Run the project's validation**

- Run: `pytest openlibrary/catalog openlibrary/mocks openlibrary/tests/catalog -q`, then
  `pytest . --ignore=infogami --ignore=vendor --ignore=node_modules -q`, then
  `ruff check openlibrary/catalog/add_book`, then `mypy openlibrary/catalog/add_book/load_book.py`
- Expected: PASS, no new failure against the baseline, ruff "All checks passed!", and no mypy error
  in `load_book.py`.

- [x] **Step 6: Commit**

```bash
git add openlibrary/catalog/add_book/load_book.py openlibrary/catalog/add_book/tests/test_load_book.py specs/2026-10-19-openlibrary-author-matching/plan.md
git commit -m "feat(openlibrary-author-matching): match authors on name, alternate names, then surname, with years"
```
