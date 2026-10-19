A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title

Legacy parsing of search service output is fragile and hard to maintain

## Description

Currently, the search results handling relies on an outdated parsing path for the service's output,
forcing an unnecessary intermediate conversion that complicates the logic and makes the results
processing harder to maintain.

## Requirements

- When `process_facet` summarizes the `has_fulltext` field, it should report the positive case first
  as `true` shown to readers as `yes`, then the negative case as `false` shown as `no`, each
  carrying its own count through unchanged and regardless of the order the raw pairs arrive in.

- Given a single search result document, `get_doc` should present it as an attribute-accessible
  result that surfaces details such as `key`, `title`, `edition_count`, `cover_edition_key`,
  `lending_edition`, `has_fulltext`, `public_scan`, and `ia`, carrying the values the document
  already provides through unchanged.

- The `url` surfaced by `get_doc` should combine the record's `key` with a space-free rendering of
  its title, yielding links such as `/works/OL182355W/The_computer_glossary`.

- Each author surfaced by `get_doc` should be reachable through a `url` built from a space-free form
  of their name, such as `/authors/OL218224A/Alan_Freedman`, alongside their own `key` and `name`.

- When optional single-value details like `lending_identifier`, `first_edition`, or `subtitle` are
  missing from the document, `get_doc` should surface them as `None` rather than substituting
  anything.

- When list style details such as `languages`, `id_project_gutenberg`, `id_librivox`,
  `id_standard_ebooks`, or `id_openstax` are absent, `get_doc` should surface them as empty lists
  rather than `None`, so consumers can iterate over them safely.

- When the document carries no collection grouping, the `collections` surfaced by `get_doc` should
  an empty set rather than `None` or absent.

## New Interfaces

- Path: `openlibrary/plugins/worksearch/code.py`
- Name: `code.process_facet`
- Type: function
- Input: field: str, facets: Iterable[tuple[str, int]]
- Output: Generator[tuple[str, str, int]]
- Description: Processes raw Solr facet data for one field, handling boolean facets, author facets,
  and language codes.

- Path: `openlibrary/plugins/worksearch/code.py`
- Name: `code.process_facet_counts`
- Type: function
- Input: facet_counts: dict[str, list]
- Output: Generator[tuple[str, list[tuple[str, str, int]]]]
- Description: Iterates over facet fields from Solr response, renames author_facet to author_key,
  and delegates to process_facet. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
