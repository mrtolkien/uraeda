A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: Imported book data can lose language and page accuracy

### Description

Imported books can be missing language information and may display inaccurate page counts for
scanned works.

## Requirements

- Language name resolution must return the matching three-character language abbreviation when
  exactly one canonical or translated language name matches the input.

- Language name resolution must compare names case insensitively and ignore accent differences when
  matching canonical and translated language names.

- Language name resolution must raise `LanguageMultipleMatchError` when more than one language
  matches the input, counting canonical name matches and translated name matches equally.

- Language name resolution must raise `LanguageNoMatchError` when no language can match the input.

- `get_ia_record` must set `languages` to a list containing the resolved abbreviation when a full
  language name resolves to one unique abbreviation, leaving `languages` unset when the name is
  ambiguous or unmatched.

- Ambiguous imported language names must log a warning containing `Multiple language matches`, and
  unmatched imported language names must log a warning containing `No language matches`.

- Imported book data must compute `number_of_pages` from `imagecount` by subtracting four when the
  result is at least one.

- For very short scanned works, imported book data must keep the original `imagecount` as
  `number_of_pages` when subtracting four would produce a value below one.

- Existing imported book fields authors, title, publisher, publish date, description, ISBN, LCCN,
  OCLC, and subjects must be preserved while applying the language and page-count behavior.

- Language records are the site objects returned for `/type/language` things, not the raw saved
  dictionaries: read the canonical name from the record's `name` attribute and its code from `code`,
  and read translations from its `name_translated` attribute, a mapping from a language code (such
  as `tg` or `fr`) to a list of translated name strings, matching against the entries of each list.
  A record with no `name_translated` (like the `Spanish` record) contributes no translated names.

- Count matches per distinct language: a language whose canonical name and one of its translations
  both match the input counts once, not twice.

- `imagecount` may arrive as a string (for example `"5"`); convert it with `int()` before computing
  `number_of_pages`.

- Emit the warnings through a standard `logging` module logger. When the language is ambiguous or
  unmatched the result must contain no `languages` key at all, and when `imagecount` is absent it
  must contain no `number_of_pages` key.

- Keep `get_languages` decorated with `functools.cache` (so it exposes `cache_clear()`), and have
  `get_abbrev_from_full_lang_name` fall back to `get_languages()` when `languages` is `None`.

## New Interfaces

- Path: `openlibrary/plugins/upstream/utils.py`
- Name: `LanguageMultipleMatchError`
- Type: class
- Input: `language_name: str`
- Output: Exception instance with `language_name` attribute
- Description: Exception raised when more than one possible language match is found.

- Path: `openlibrary/plugins/upstream/utils.py`
- Name: `LanguageNoMatchError`
- Type: class
- Input: `language_name: str`
- Output: Exception instance with `language_name` attribute
- Description: Exception raised when no matching languages are found.

- Path: `openlibrary/plugins/upstream/utils.py`
- Name: `get_abbrev_from_full_lang_name`
- Type: function
- Input: `input_lang_name: str, languages=None`
- Output: `str`
- Description: Returns the three-character language code matching the given language name by
  searching canonical and translated language names. Raises `LanguageNoMatchError` when no match is
  found and `LanguageMultipleMatchError` when multiple matches exist. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
