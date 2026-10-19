A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: Search index updates cannot be handled per record type or inspected afterwards

### Description

Currently works, authors and editions each travel their own route through one large batch routine,
so none of them can be processed or extended apart from the others, and behavior meant for all of
them only takes effect where it was written into a particular route. A batch also reports nothing
back once it finishes, so what it added and removed cannot be inspected.

## Requirements

- `SolrUpdateState` should represent one pending update through its `keys`, `adds`, `deletes` and
  `commit` fields, should be constructible from part of that information as in
  `SolrUpdateState(commit=True)`, and any collection left out should start empty and unshared, with
  no commit requested.

- `solr_update` should accept such a representation and send its deletions, additions and commit
  request as one Solr command body, keeping its existing treatment of successful, unavailable, non
  JSON, invalid request, partial document error and other non OK responses without letting a
  response parsing error escape.

- The per record operation should be reachable as `update_key`, should return one of these
  representations, and should be awaitable for every record type, authors included.

- `WorkSolrUpdater` should handle work and edition documents alike, should index an edition with no
  work as a synthetic work rather than removing it, and should carry a title supplied by an
  associated edition onto the resulting document.

- `AuthorSolrUpdater` should index the author it receives rather than removing it, keeping that
  author key on the document it produces.

- `update_keys` should handle `/works/`, `/authors/` and `/books/` keys through the behavior of each
  record type and return one representation carrying all their additions and deletions, requesting a
  commit unless the caller asks for none.

- Documents the in memory data provider already holds, deletions and redirects among them, should be
  resolved from it without an external Solr search, and keys whose documents have type
  `/type/delete` should all end up among the deletions with nothing added.

- A `/books/` redirect should contribute its own key to the deletions and be followed to the
  document at its `location` in its place, standing ahead of that target when the target is itself
  deleted.

- `SolrUpdateState` must represent a complete Solr update using readable `keys`, `adds`, `deletes`,
  and `commit` fields. These collection fields must default to independent empty lists, and
  construction with keyword arguments such as `SolrUpdateState(commit=True)` must be supported.

- A `SolrUpdateState` must be able to serialize its pending additions, deletions, and commit flag as
  Solr command JSON for use by `solr_update()`.

- `solr_update()` must accept a `SolrUpdateState` as its update input and send the serialized
  additions, deletions, and commit request to the selected Solr endpoint. Existing handling of
  successful, unavailable, non-JSON, invalid-request, partial-document-error, and other non-OK
  responses must remain unchanged and must not expose an unhandled response-parsing error.

- Record-specific updater operations must return a `SolrUpdateState`. `WorkSolrUpdater.update_key()`
  must accept both work documents and edition documents that have no `works` field. For such an
  orphan edition, it must index a synthetic work rather than deleting anything.

- When an associated edition supplies a title, that title must be preserved in the resulting work
  document.

- `AuthorSolrUpdater.update_key()` must index the author rather than deleting anything, and the
  resulting document must retain the input author key.

- `update_keys()` must process `/works/`, `/authors/`, and `/books/` keys using their corresponding
  record-specific updater behavior and return one aggregated `SolrUpdateState`.

- Documents available through the in-memory `data_provider` must be processed from that provider
  without requiring an external Solr search. This also applies to `/books/` documents representing
  deletions or redirects.

- When the documents associated with the supplied keys have type `/type/delete`, the returned state
  must contain every supplied key in `deletes` and no additions.

- When a `/books/` document is a redirect, its source key must be added to `deletes` before
  processing its `location` target.

## New Interfaces

- Path: `openlibrary/solr/update_work.py`

- Name: `SolrUpdateState`

- Type: class

- Input: `keys: list[str] = []`, `adds: list[SolrDocument] = []`, `deletes: list[str] = []`,
  `commit: bool = False`

- Output: `NA`

- Description: Public dataclass representing an aggregated Solr update, including the original keys,
  documents to add, keys to delete, and whether a commit is required.

- Path: `openlibrary/solr/update_work.py`

- Name: `SolrUpdateState.__add__`

- Type: method

- Input: `self`, `other: SolrUpdateState`

- Output: `SolrUpdateState`

- Description: Returns a new update state containing the combined keys, additions, and deletions of
  both states, with commit enabled when either state requests it.

- Path: `openlibrary/solr/update_work.py`

- Name: `SolrUpdateState.has_changes`

- Type: method

- Input: `self`

- Output: `bool`

- Description: Reports whether the state contains any pending additions or deletions.

- Path: `openlibrary/solr/update_work.py`

- Name: `SolrUpdateState.to_solr_requests_json`

- Type: method

- Input: `self`, `indent: str | None = None`, `sep: str = ','`

- Output: `str`

- Description: Serializes the pending deletions, additions, and commit flag as a Solr-compatible
  JSON command body.

- Path: `openlibrary/solr/update_work.py`

- Name: `SolrUpdateState.clear_requests`

- Type: method

- Input: `self`

- Output: `None`

- Description: Removes all pending additions and deletions from the state while preserving its keys
  and commit flag.

- Path: `openlibrary/solr/update_work.py`

- Name: `AbstractSolrUpdater`

- Type: class

- Input: `NA`

- Output: `NA`

- Description: Public base class defining the shared contract and document-preloading behavior for
  record-specific Solr updaters.

- Path: `openlibrary/solr/update_work.py`

- Name: `AbstractSolrUpdater.key_test`

- Type: method

- Input: `self`, `key: str`

- Output: `bool`

- Description: Reports whether a key matches the prefix handled by the updater.

- Path: `openlibrary/solr/update_work.py`

- Name: `AbstractSolrUpdater.preload_keys`

- Type: async method

- Input: `self`, `keys: Iterable[str]`

- Output: `None`

- Description: Preloads the documents associated with the supplied keys through the configured data
  provider.

- Path: `openlibrary/solr/update_work.py`

- Name: `AbstractSolrUpdater.update_key`

- Type: async method

- Input: `self`, `thing: dict`

- Output: `SolrUpdateState`

- Description: Defines the record-processing operation that concrete updater classes must provide.

- Path: `openlibrary/solr/update_work.py`

- Name: `EditionSolrUpdater`

- Type: class

- Input: `NA`

- Output: `NA`

- Description: Public updater for `/books/` records that identifies the work keys requiring further
  processing for an edition.

- Path: `openlibrary/solr/update_work.py`

- Name: `EditionSolrUpdater.update_key`

- Type: async method

- Input: `self`, `thing: dict`

- Output: `SolrUpdateState`

- Description: Returns an update state containing the work keys associated with an edition,
  including the synthetic work key required for an orphan edition.

- Path: `openlibrary/solr/update_work.py`

- Name: `WorkSolrUpdater`

- Type: class

- Input: `NA`

- Output: `NA`

- Description: Public updater that produces Solr additions and related deletions for work and
  orphan-edition documents.

- Path: `openlibrary/solr/update_work.py`

- Name: `WorkSolrUpdater.preload_keys`

- Type: async method

- Input: `self`, `keys: Iterable[str]`

- Output: `None`

- Description: Preloads work documents and their associated editions before processing.

- Path: `openlibrary/solr/update_work.py`

- Name: `WorkSolrUpdater.update_key`

- Type: async method

- Input: `self`, `work: dict`

- Output: `SolrUpdateState`

- Description: Produces the Solr update state for a work or creates a synthetic work addition when
  given an edition without an associated work.

- Path: `openlibrary/solr/update_work.py`

- Name: `AuthorSolrUpdater`

- Type: class

- Input: `NA`

- Output: `NA`

- Description: Public updater that produces Solr additions for author records, including their
  derived search data.

- Path: `openlibrary/solr/update_work.py`

- Name: `AuthorSolrUpdater.update_key`

- Type: method

- Input: `self`, `thing: dict`

- Output: `Awaitable[SolrUpdateState]`

- Description: Starts asynchronous author processing and returns an awaitable that resolves to the
  resulting Solr update state. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
