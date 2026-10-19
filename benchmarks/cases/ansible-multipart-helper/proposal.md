A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title

Lack of a public helper to build `multipart/form-data` request bodies

# Description

The `ansible.module_utils.urls` module does not expose a `prepare_multipart` function to assemble a
`multipart/form-data` request body from a mapping of fields. Callers that need to send a
`multipart/form-data` payload have no shared public surface that returns the `Content-Type` header
(including the `boundary`) together with the prepared byte-string body.

The helper is not available to accept a mapping whose values are either plain strings or
sub-mappings describing a field via `filename`, `content`, and `mime_type`, and to return a tuple
`(content_type, body)` where `content_type` is a `multipart/form-data` value with a `boundary`.
Input validation is not available either: invalid input types do not raise `TypeError`, and a
mapping value that provides neither `filename` nor `content` does not raise `ValueError`. When
`mime_type` is omitted and the type cannot be guessed, `application/octet-stream` is not applied as
a fallback.

## Requirements

- The function `prepare_multipart` must be importable from `ansible.module_utils.urls`.

- `prepare_multipart` must accept a single argument `fields` that is a mapping whose values are
  either strings (treated as plain text form fields with `Content-Type: text/plain`) or sub-mappings
  describing a form field via the keys `filename`, `content`, and `mime_type`.

- `prepare_multipart` must return a tuple `(content_type, body)` where `content_type` is a string
  parsable as `multipart/form-data` with a non-empty `boundary` parameter, and `body` is a
  byte-string containing the assembled multipart payload.

- The returned `body` must contain one MIME part per input field, with parts ordered alphabetically
  by field name, each carrying `Content-Disposition: form-data; name="<field>"`, and adding
  `; filename="<basename>"` when the field provides a `filename`.

- For a sub-mapping field that provides `filename` but no `content`, the part payload must be read
  from the file on disk and the part must include `Content-Transfer-Encoding: base64` together with
  the corresponding `Content-Type` header.

- `prepare_multipart` must raise `TypeError` when the `fields` argument is not a mapping (for
  example, when passed the string `"foo"`).

- `prepare_multipart` must raise `TypeError` when any value in the `fields` mapping is neither a
  string nor a mapping (for example, when passed `{"foo": None}`).

- `prepare_multipart` must raise `ValueError` when a sub-mapping value provides neither `filename`
  nor `content` (for example, when passed `{"foo": {}}`).

- When a sub-mapping field omits `mime_type` and the MIME type cannot be inferred (either because
  `mimetypes.guess_type` returns `None` or because it raises an exception), the corresponding MIME
  part in `body` must carry `Content-Type: application/octet-stream`.

- Within each individual MIME part, the headers MUST appear in this exact order: when a
  Content-Transfer-Encoding header applies to that part it comes first, followed by the Content-Type
  header, followed by the Content-Disposition header.

- Base64-encoded part payloads MUST be line-wrapped at 76 characters per line (per RFC 2045); a
  single unwrapped line is NOT acceptable.

- The overall assembled body MUST be byte-identical (after boundary substitution) to the multipart
  body produced by Python's standard-library email.mime.multipart.MIMEMultipart('form-data')
  serialized with email.policy.HTTP on Python 3, including its default `===============N==` boundary
  format.

- Parts whose payload is supplied inline via `content` are emitted as raw bytes with no
  Content-Transfer-Encoding header, even when `filename` is also given; only parts read from disk
  are base64-encoded.

- Each individual part's header block must consist only of the headers shown in the fixture
  `multipart.txt` (`Content-Transfer-Encoding` when applicable, then `Content-Type`, then
  `Content-Disposition`) and no other header, and the `Content-Type` value must carry no parameters:
  a plain string field produces exactly `Content-Type: text/plain`.

- A sub-mapping that provides `content` but neither `filename` nor `mime_type` must produce
  `Content-Type: application/octet-stream`, not `text/plain`.

- Call `mimetypes.guess_type(filename)` through the `mimetypes` module at call time (not via a bound
  alias imported at module load), and treat any exception it raises as an unknown type.

## New Interfaces

- Path: `lib/ansible/module_utils/urls.py`
- Name: `urls.prepare_multipart`
- Type: function
- Input: fields: Mapping
- Output: Tuple[str, bytes]
- Description: Constructs a multipart/form-data payload from a mapping of fields, supporting both
  plain text fields and file uploads with proper MIME type handling. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
