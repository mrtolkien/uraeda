A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title: Backend support for "Best Book Awards" is missing (API endpoints and read-prerequisite validation)

## Description

Open Library has no server-side support for "Best Book Awards". There is no public JSON endpoint
that lets an authenticated patron nominate a work for an award, update or remove that nomination, or
ask how many nominations exist, so requests to the awards endpoints are not handled by the server
and fail or come back as not found. Nothing on the server side checks that such a request comes from
an authenticated patron, and nothing requires a patron to have marked a work as "Already Read"
before nominating it, so the read prerequisite the feature is meant to enforce is enforced nowhere.

## Requirements

- A public API endpoint must handle `POST /works/OL{work_id}W/awards.json`, where `{work_id}` is the
  numeric work id taken from the URL path.

- When the request does not come from an authenticated patron, the award endpoint must respond with
  a JSON object whose `errors` value contains the message `"Authentication failed"`.

- The award endpoint must read the request parameters `op`, `topic`, `comment` and `edition_key`,
  and each of them must carry a default so that a request supplying only `op` is still handled and
  every other parameter still has a value.

- The `op` parameter must default to `"add"`, and the operations the award endpoint recognizes must
  be `"add"`, `"update"` and `"remove"`.

- When `edition_key` is supplied, the award endpoint must use the numeric id carried by that
  OLID-style key as the edition identifier, as an integer; when it is absent, the nomination must be
  recorded with no edition.

- For `op` of `"add"` or `"update"`, the award endpoint must record the nomination through
  `Bestbook.add`, supplying to it, by their parameter names, the patron's username, the `work_id`
  received from the path unchanged, and the request `topic`, `comment` and integer edition
  identifier, and must respond with a JSON object of the form `{"success": true, "award": <value>}`
  where `<value>` is the value returned by `Bestbook.add`.

- For `op` of `"remove"`, the award endpoint must remove the patron's nomination for that work
  through `Bestbook.remove` and respond with a JSON object of the form
  `{"success": true, "rows": <int>}` where `<int>` is the value returned by `Bestbook.remove`.

- `Bestbook.add` must establish whether the patron has marked the work as "Already Read" through
  `Bookshelves.user_has_read_work`, and when the patron has not, it must raise
  `Bestbook.AwardConditionsError` whose message includes the user-facing text
  `"Only books which have been marked as read may be given awards"`.

- `Bestbook.add` must raise `Bestbook.AwardConditionsError` when the patron has already nominated
  the given work.

- `Bestbook.add` must raise `Bestbook.AwardConditionsError` when the patron has already used the
  given topic for a different work.

- `Bestbook.add` must establish both duplicate conditions from the patron's existing nominations,
  obtained through `Bestbook.get_awards` filtered by work and by topic respectively.

- `Bestbook.add` must complete the read-status check and both duplicate checks before any database
  access, so that a nomination that fails a condition surfaces as `Bestbook.AwardConditionsError`
  and never as a database error.

- When `Bestbook.AwardConditionsError` is raised while the award endpoint is handling a request, the
  endpoint must respond with a JSON object whose `errors` value contains the message carried by the
  raised error.

- `Bestbook.AwardConditionsError` must be an exception type defined on the `Bestbook` class.

- A separate public API endpoint must handle `GET /awards/count.json`, must accept optional
  `work_id`, `username` and `topic` filters from the request, and must respond with a JSON object of
  the form `{"count": <int>}` whose value is the count `Bestbook.get_count` returns for those
  filters.

- A public API endpoint must handle `POST /works/OL{work_id}W/awards.json`, where `{work_id}` is the
  numeric work id taken from the URL path. The endpoint must require authentication: the current
  user is obtained via `openlibrary.accounts.get_current_user()`, and when there is no current user
  the endpoint must respond with a JSON object whose `errors` value contains the message
  `"Authentication failed"`.

- The award endpoint must read its parameters from the request (`op`, `topic`, `comment`, and
  `edition_key`), defaulting `op` to `"add"`. The recognized operations are `"add"`, `"update"`, and
  `"remove"`. The `edition_key`, when provided, is an OLID-style key whose numeric id is used as the
  edition identifier, as an integer (for example, an `edition_key` of `"OL42M"` yields edition id
  `42`); when absent it is treated as no edition.

- For `op` in `{"add", "update"}`, the endpoint must add the nomination via `Bestbook.add`,
  supplying to it, by their parameter names, the `username` (derived from the current user's key),
  the `work_id` received from the path unchanged, the request `topic` and `comment`, and the integer
  `edition_id`, and respond with a JSON object of the form `{"success": true, "award": <value>}`
  where `<value>` is the value returned by `Bestbook.add`.

- For `op` equal to `"remove"`, the endpoint must remove the patron's nomination for the work via
  `Bestbook.remove(username, work_id=...)` and respond with a JSON object of the form
  `{"success": true, "rows": <int>}` where `<int>` is the value returned by `Bestbook.remove`.

- When adding a nomination, the system must validate that the patron has marked the work as “Already
  Read” using `Bookshelves.user_has_read_work(username, work_id)`. `Bookshelves.user_has_read_work`
  must return `True` only when the user's read status for the work equals the `"Already Read"`
  preset bookshelf, and `False` otherwise.

- `Bestbook.add` must validate award conditions before recording the nomination. When the patron has
  not marked the work as read, it must raise `Bestbook.AwardConditionsError` whose message includes
  the user-facing text `"Only books which have been marked as read may be given awards"`. The award
  endpoint must catch `Bestbook.AwardConditionsError` and respond with a JSON object whose `errors`
  value contains that message.

- `Bestbook.add` must reject a duplicate nomination by the same patron: attempting to nominate a
  work the patron has already nominated, or reusing a topic the patron has already nominated for a
  different work, must raise `Bestbook.AwardConditionsError`. The class must expose a `get_awards`
  method (see New Interfaces) that returns the list of matching nominations for the given filters.

- A separate public API endpoint must handle `GET /awards/count.json`, accepting optional `work_id`,
  `username`, and `topic` filters from the request and responding with a JSON object of the form
  `{"count": <int>}` whose value is obtained from
  `Bestbook.get_count(work_id=..., username=..., topic=...)`.

- Treat `work_id` as an opaque string and pass it through unchanged (callers may supply values like
  `OL123W`); do not convert or normalize it to an integer. Internal calls should forward it as the
  `work_id=` keyword argument (and `topic=` for topic queries).

- `bestbook_award.POST` and `bestbook_count.GET` must return the response as an object indexable by
  `'rawtext'`, whose `rawtext` entry is the JSON body as a string, so that applying `json.loads` to
  the `['rawtext']` entry yields the response dict.

- `Bestbook.add` must run all validation (`Bookshelves.user_has_read_work`, then the duplicate-work
  and duplicate-topic checks via `get_awards`) before touching the database: when
  `Bookshelves.user_has_read_work` and `Bestbook.get_awards` are the only things patched and no
  database is reachable, a failing condition must surface as `Bestbook.AwardConditionsError` and not
  as a database error.

- `Bestbook.add` must be callable with only the `username`, `work_id` and `topic` keyword arguments;
  `comment` defaults to an empty string and `edition_id` to `None`. Call `get_awards` with keyword
  arguments only (it may be replaced by a callable that accepts only `**kw`): the duplicate-work
  check passes `work_id` as a keyword and the duplicate-topic check passes `topic` as a keyword.

- Read request parameters through `web.input`, supplying a default for every expected field as
  keyword arguments (`op` defaulting to `"add"`; `edition_key`, `topic` and `comment` also given
  defaults), so that a request carrying only `op` still exposes every field; a `None` value for
  `comment` or `edition_key` must be handled without error.

- Obtain the user via `openlibrary.accounts.get_current_user()`, looked up on the
  `openlibrary.accounts` module at call time so that patching
  `openlibrary.accounts.get_current_user` takes effect. The user object may expose only `key`, of
  the form `/users/{key}`; the `username` passed on is the final path segment of that key
  (`testuser` for a user created with key `testuser`).

- `Bookshelves.user_has_read_work(username, work_id)` must derive its result from
  `Bookshelves.get_users_read_status_of_work` called with the same `username` and `work_id`, and
  return `True` only when that status is the "Already Read" preset bookshelf (a status of 3 means
  read; 2 does not), `False` otherwise.

## New Interfaces

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook`

- Type: class

- Input: NA

- Output: NA

- Description: Provides Best Book Award operations for Open Library.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.AwardConditionsError`

- Type: class

- Input: NA

- Output: NA

- Description: Exception raised when award conditions are not met.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.add`

- Type: method

- Input: cls, username (str), work_id (str), topic (str), comment (str, default ""), edition_id (int
  | None)

- Output: int | None

- Description: Adds an award when conditions are met, otherwise raises
  Bestbook.AwardConditionsError.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.remove`

- Type: method

- Input: cls, username (str), work_id (str | None), topic (str | None)

- Output: int

- Description: Removes any award for the username where the work_id or topic matches.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.get_count`

- Type: method

- Input: cls, work_id (str | None), username (str | None), topic (str | None)

- Output: int

- Description: Returns the count of best book awards matching the specified filters.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.get_awards`

- Type: method

- Input: cls, work_id (str | None), username (str | None), topic (str | None)

- Output: list

- Description: Returns the list of best book awards matching the specified filters (any combination
  of work_id, username, topic).

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.get_leaderboard`

- Type: method

- Input: cls

- Output: list[dict]

- Description: Returns the leaderboard of best books, aggregated as work_id plus award count,
  ordered by count descending.

- Path: `openlibrary/core/bestbook.py`

- Name: `Bestbook.prepare_query`

- Type: method

- Input: cls, select (str, default "*"), work_id (str | None), username (str | None), topic (str |
  None)

- Output: tuple[str, dict]

- Description: Builds the SQL query string and its bound variables for fetching awards matching the
  specified filters.

- Path: `openlibrary/core/bookshelves.py`

- Name: `Bookshelves.user_has_read_work`

- Type: method

- Input: cls, username (str), work_id (str)

- Output: bool

- Description: Checks whether the user has marked the work as "Already Read".

- Path: `openlibrary/core/models.py`

- Name: `Work.get_awards`

- Type: method

- Input: self

- Output: list

- Description: Returns the best book awards recorded for this work, and an empty list when the work
  has no key.

- Path: `openlibrary/core/models.py`

- Name: `Work.check_if_user_awarded`

- Type: method

- Input: self, username (str)

- Output: bool

- Description: Reports whether the given patron has nominated this work, and False when the work has
  no key.

- Path: `openlibrary/core/models.py`

- Name: `Work.get_award_by_username`

- Type: method

- Input: self, username (str)

- Output: award record or None

- Description: Returns the award this patron gave this work, and None when there is no such award or
  the work has no key.

- Path: `openlibrary/plugins/openlibrary/api.py`

- Name: `bestbook_award`

- Type: class

- Input: NA

- Output: NA

- Description: API endpoint class for managing Best Book Award nominations.

- Path: `openlibrary/plugins/openlibrary/api.py`

- Name: `bestbook_award.POST`

- Type: method

- Input: self, work_id (str)

- Output: JSON string

- Description: Adds, updates, or removes a Best Book award for an authenticated user.

- Path: `openlibrary/plugins/openlibrary/api.py`

- Name: `bestbook_count`

- Type: class

- Input: NA

- Output: NA

- Description: API endpoint class for retrieving award counts.

- Path: `openlibrary/plugins/openlibrary/api.py`

- Name: `bestbook_count.GET`

- Type: method

- Input: self

- Output: JSON string

- Description: Returns the count of best book awards matching the specified filter criteria.

- Input: N/A

- Output: N/A </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
