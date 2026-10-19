# Rulings: Match authors on alternate names and surname with birth and death dates

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: An empty date counts as absent

- **Decision**: an import's `birth_date` or `death_date` is present only when its value is truthy:
  `""` and `None` count as absent, so such an import takes the single name step.
- **Rationale**: the spec's steps 1 to 4 need two years; an empty value can give none, and would
  send the import to steps that can only fail, then to a new duplicate author.
  [`author_dates_match`](/openlibrary/catalog/utils/__init__.py) already skips `None` dates.
- **Alternatives considered**: key presence, `'death_date' in author`, as the old `find_entity` did:
  an empty value then blocks every name match the import would get without it.
- **If wrong**: an import with an empty date links by name alone; undo by testing key presence in
  `find_author`.
- **Where**: task 2 of the plan, `find_author`.

## R2: Remove `pick_from_matches`

- **Decision**: `pick_from_matches` is deleted with the old filtering of `find_entity`.
- **Rationale**: `find_author` now orders candidates by numeric key within each step, as the spec
  requires, and `pick_from_matches` has no other caller in the repository.
- **Alternatives considered**: keeping it unused, which leaves a second, different tie-break rule
  beside the one `find_author` owns.
- **If wrong**: an outside script importing it breaks; it can be restored from git.
- **Where**: task 2 of the plan, `load_book.py`.

## R3: The inbox note is written on the default branch

- **Decision**: the spec's note on production's `~` is committed to `specs/INBOX.md` on `main`,
  alone, rather than on the feature branch.
- **Rationale**: inbox notes live on the default branch, as the workflow's inbox rules say, so the
  note is seen even if this branch waits.
- **Alternatives considered**: committing it with the feature's code, which hides it until merge.
- **If wrong**: the note moves with one commit.
- **Where**: task 2 of the plan, step 4.

## R4: The query limit stays infogami's default, as the spec settled

- **Decision**: the final review found that infogami returns at most 20 rows per query, unsorted,
  when no `limit` is sent, so in production the surname step (`* Smith`) sees 20 arbitrary authors
  out of possibly thousands, and often misses the right one. The queries keep the default limit.
- **Rationale**: the answered clarifications settled "The query limit stays infogami's default", and
  the approved spec keeps it. Raising the limit, or narrowing the surname query by year, changes
  production load and behaviour the human approved, so it is theirs to choose, on the pull request.
- **Alternatives considered**: `'limit': 1000`, infogami's maximum, which reads up to 1,000 author
  records per query; a year filter such as `birth_date~ "*1829*"`, which the spec does not describe.
- **If wrong**: imports with common surnames keep creating duplicates in production, as today; the
  fix is one `limit` key in `_query_authors`.
- **Where**: `_query_authors` in `load_book.py`.

## R5: The final review's minor findings are deferred

- **Decision**: the minor findings stay unfixed and are noted in the inbox under **Deferred fixes**:
  an unused `seen` argument of `_walk_redirects`, `_query_authors`' docstring saying "ignoring case"
  (true in the mock only), integer dates raising `TypeError` (as before the branch), and missing
  tests for an organization with a comma or dates, a surname inside a longer word ("Fitzbrewer"),
  and step 3 against a candidate with a birth year only.
- **Rationale**: the workflow fixes only critical and important findings; none of these changes what
  an import links to today.
- **Alternatives considered**: fixing them in passing, which the workflow forbids.
- **If wrong**: each is a small follow-up.
- **Where**: `load_book.py` and `test_load_book.py`.
