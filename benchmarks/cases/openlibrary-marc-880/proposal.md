A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: Incomplete and inconsistent extraction of MARC 880 alternate script fields

### Description

MARC records can store alternate-script metadata in `880` fields, including non-Latin titles,
subtitles, author names, publishers and publication places. These fields may be linked to their
Latin-script counterparts through subfield `6`, or they may appear on their own when no matching
Latin-script field exists.

During import, this alternate-script metadata is not consistently extracted or exposed in the parsed
edition. Records lose their original-script titles and author names, drop alternate titles when
several `880` linkages are present, lose a subtitle that exists only in the alternate-script field,
and fail to pick up publisher and publication-place data that is carried only by an `880` field
whose Latin-script counterpart is absent. Reaching this data is also awkward for the parsing code,
because a binary record and an XML record hand back different kinds of field objects and require the
caller to build or decode the field set before it can be read.

The same import path normalizes related MARC data inconsistently. Repeated entries survive in list
fields such as series, because trailing cataloging punctuation is left on part of a series field and
two spellings of the same series are then treated as different values. The standard publisher
abbreviation for an unknown publisher is truncated. A subtitle that is nothing but a bracketed
cataloging note is reported as if it were a real subtitle. Organizational author names keep
cataloging suffixes such as `[from old catalog]`.

## Requirements

- Reading a field from a MARC binary record and reading a field from a MARCXML record must yield
  field objects that support the same indicator access and subfield extraction operations, so that
  the same parsing code can consume either record kind without special-casing it.

- Looking up the fields for a requested tag must return the record's field objects directly, without
  the caller first having to build or decode the record's field set.

- Looking up a control field must return the first matching control field's value as a string.

- When a record carries more than one `008` control field, control field lookup must prefer a value
  that is 40 characters long, and among the candidates it must return the one with the fewest
  whitespace characters.

- When a source field such as `245`, `260`, `100` or `700` carries a subfield `6` linkage, the
  alternate-script `880` field named by that linkage must be located and used as that source field's
  alternate-script counterpart.

- A source field and an `880` field must be treated as linked when the alternate-script field's
  subfield `6` begins with the source field's tag, a hyphen and the occurrence number carried by the
  source field's own subfield `6`, which reads `880-<occurrence>`; whatever follows that prefix,
  such as a script identifier, must not affect the match.

- When a record has neither a `260` nor a `264` field, the publisher name and the publication place
  must be taken from the alternate-script `880` field that names `260` as its source, even though
  that source field is absent from the record.

- When a `245` field is linked to an `880` field, the parsed edition's title must be the
  original-script title carried by that linked field, and the Latin-script title must be kept as an
  alternate title of the edition.

- When a `245` field carries no subtitle subfield of its own but its linked `880` field does, the
  parsed edition's subtitle must be taken from the linked field's subtitle subfields.

- A subtitle whose value consists entirely of a bracketed expression must not be reported as a
  subtitle at all; the parsed edition must carry no subtitle in that case.

- Alternate titles taken from fields `246`, `730` and `740` must be combined with the alternate
  titles produced from linked `880` title data, and neither source may replace the other.

- When a `100`, `700` or `720` author field is linked to an `880` field, the alternate-script form
  of that name must be attached to the same author as an alternate name, carried on the author entry
  under the key `alternate_names` as a list of strings, and the author's entity type and date
  metadata must be preserved.

- Trailing punctuation and whitespace, specifically `.`, `,` and `;`, must be removed from every
  series subfield value that is used to build a series entry, including the volume or number
  designation, before the parts of one series field are joined together.

- Series values must be deduplicated while preserving their original order, so that two fields
  describing the same series contribute a single entry.

- A publisher recorded with the standard abbreviation for an unknown publisher must be reported as
  `[s.n.]`, with the closing bracket intact.

- An organizational author name that ends with a cataloging suffix such as `[from old catalog]` must
  have that suffix removed from the parsed author name.

- Constructing a field object for an XML-backed record must take the record as the first argument
  and the XML element as the second, and the record must be accepted as absent, so that a field can
  be built on its own.

- A field object taken from an XML-backed record must retain a reference to the record it came from,
  so that author and linkage parsing can reach the record starting from the field.

- Notes must continue to be collected from the note fields numbered `500` to `589`, excluding `505`
  and `520`; a note field numbered `590` or above must not contribute to the parsed edition's notes.

- Other places in the repository still hold the previous form of some sample data and the parsing
  results recorded for it, and they are updated separately outside the scope of this change, so a
  mismatch confined to them is expected while this change is in progress and they must be left alone
  rather than worked around or accommodated in the parsing code.

- When 245 carries its own subtitle it is kept even if the linked 880 also has one; alternate-script
  publisher/place are used only when 260/264 are absent.

- `name_from_list` must join its `name_parts` with a single space after removing a trailing
  `[from old catalog]` cataloging suffix from each part and stripping surrounding brackets and
  trailing punctuation, and the joined name must not end with a period. Person, organization and
  event names (100/110/111/700/710/711/720) all pass through it, so an organization whose parts are
  `Iowa.` and `Agricultural and Home Economics Experiment Station, Ames. [from old catalog]` is
  reported with the name `Iowa. Agricultural and Home Economics Experiment Station, Ames`.

- An author's `alternate_names` value is `name_from_list` applied to the linked 880 field's `$a`
  values, with the same cleanup as the primary name and nothing more (`横井 清.` keeps its dot; a
  trailing comma is removed). Omit the key when there is no linkage or no `$a`.

- A subtitle discarded as a bracketed note leaves the `subtitle` key absent, not `None`. The
  original-script title from a linked 880 uses only its `$a`; `by_statement` and publisher data stay
  Latin-script when 245 `$c` / 260 exist.

- `get_fields(tag)` returns a list; `get_subfields(want)` returns an iterator usable with `next()`.
  `MarcBinary.read_fields()` with no argument must keep yielding every field, control fields as
  `str` and data fields as `BinaryDataField(rec, line)`.

- `read_author_person` must accept a field constructed with `DataField` whose record argument is
  `None`, and must return the parsed author for such a record-less field whenever it carries no
  subfield `6` linkage; only a field with a subfield `6` linkage may require access to its record.

## New Interfaces

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase`
- Type: class
- Input: NA
- Output: NA
- Description: Public base class for MARC field implementations, defining shared subfield access
  behavior for binary and XML MARC fields.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase.get_subfields`
- Type: method
- Input: `want: str`
- Output: `Iterator[tuple[str, str]]`
- Description: Yields the field's `(code, value)` subfield pairs restricted to the subfield codes
  named in `want`.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase.get_subfield_values`
- Type: method
- Input: `want: str`
- Output: `list[str]`
- Description: Returns the stripped values of the field's subfields whose code is named in `want`,
  as a list of strings.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase.get_contents`
- Type: method
- Input: `want: str`
- Output: `dict[str, list[str]]`
- Description: Returns the field's subfields whose code is named in `want`, grouped into a mapping
  from each subfield code to the list of its values.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase.get_all_subfields`
- Type: method
- Input: NA
- Output: `Iterator[tuple[str, str]]`
- Description: Yields every `(code, value)` subfield pair carried by the field, in order.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcFieldBase.get_lower_subfield_values`
- Type: method
- Input: NA
- Output: `Iterator[str]`
- Description: Yields the values of every subfield of the field whose code is a lowercase letter.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcBase.get_control`
- Type: method
- Input: `tag: str`
- Output: `str | None`
- Description: Returns the first matching control field value, with special handling for duplicate
  `008` fields by selecting the most relevant 40-character entry.

- Path: `openlibrary/catalog/marc/marc_base.py`
- Name: `MarcBase.get_linkage`
- Type: method
- Input: `original: str`, `link: str`
- Output: `MarcFieldBase | None`
- Description: Returns the linked alternate-script `880` field whose subfield `6` matches the
  requested original field linkage.

- Path: `openlibrary/catalog/marc/parse.py`
- Name: `title_from_list`
- Type: function
- Input: `title_parts: list[str]`, `delim: str = ' '`
- Output: `str`
- Description: Joins title parts with the given delimiter after stripping typical trailing
  cataloging punctuation from each part, and returns the resulting title string.

- Path: `openlibrary/catalog/marc/parse.py`
- Name: `name_from_list`
- Type: function
- Input: `name_parts: list[str]`
- Output: `str`
- Description: Joins author name parts into a single name, removing cataloging suffixes such as
  `[from old catalog]`, surrounding brackets and trailing punctuation. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
