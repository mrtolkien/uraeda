A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title Config value type coercion loses tags and handles several input types inconsistently

## Description

Ansible configuration values passed through `ensure_type()` can lose their data tags during type
conversion and behave inconsistently for several supported value types. Tagged values may return
untagged converted results, unhashable values can fail during boolean conversion, bytes can produce
unclear conversion behavior, and sequence or mapping inputs may not be normalized to the requested
`list` or `dict` types. This affects configuration handling because callers expect `ensure_type()`
to preserve trust and origin metadata while reliably coercing values according to the configured
type.

## Requirements

- `ensure_type()` must continue to return `None` unchanged when the input value is `None`,
  regardless of the requested value type.

- When the requested type is `bool` or `boolean`, `ensure_type()` must use Ansible's standard
  non-strict boolean conversion rules, including returning `False` instead of raising when an
  unhashable non-boolean value is provided.

- `ensure_type()` must coerce `True` and `False` to `1` and `0` respectively when the requested type
  is `int` or `integer`.

- `ensure_type()` must reject invalid conversions with a `ValueError` whose message reads exactly
  `Invalid value provided for '<type>': <value>`, where `<type>` is the requested type name and
  `<value>` is the offending value rendered with Python `repr` (for example,
  `Invalid value provided for 'int': 'a'`, `Invalid value provided for 'list': b'a'`, or
  `Invalid value provided for 'int': -1.1`).

- Byte values must be rejected for known value types instead of producing undefined behavior or
  unhandled exceptions.

- When the requested type is `list`, string inputs must be split on commas with whitespace stripped
  and quoted items unquoted, while sequence inputs such as tuples must be returned as concrete
  `list` instances.

- When the requested type is `dict` or `dictionary`, mapping inputs must be returned as concrete
  `dict` instances.

- `pathspec` and `pathlist` conversions must reject non-string inputs and non-string list items
  instead of attempting to resolve them as paths.

- String values read from INI configuration sources must continue to be unquoted after type
  coercion.

- Converted values must preserve Ansible data tags from the original value, including preserving
  tags on each element produced when a tagged string is converted to a list. When conversion does
  not change the value, `ensure_type()` must return the original value instance unchanged.

- Temporary path conversions using `tmp`, `tmppath`, or `temppath` must create a unique empty
  directory under the resolved base path and must not propagate tags to the returned temporary path.

- Unknown value types must return the input value unchanged, except that string values from INI
  configuration sources must still follow the standard unquoting behavior.

- For `str`/`string`, only str, bool, int, float and complex inputs are valid;
  sequences/mappings/bytes are invalid conversions.

- In the `Invalid value provided for '<type>': <value>` message, `<type>` is the `value_type` string
  exactly as passed by the caller (lowercased), e.g. `'tmp'`, `'none'`, `'dict'`, `'integer'`; never
  a canonical alias such as `'temppath'`, `'None'`, or `'dictionary'`.

- `none` is a recognized value type: `None` and the literal string `'None'` convert to `None`; any
  other input for it is an invalid conversion. `tmp`/`tmppath`/`temppath` and `dict`/`dictionary`
  reject non-string / non-mapping inputs (such as the int `1`) with the same ValueError.

- Converted `int` and `list` results must carry the data tags of the original value: for an
  `Origin`-tagged input converted to `int` or `list` (including a `list` built from a tagged tuple),
  `Origin.is_tagged_on(result)` must hold, and when a tagged string is split into a `list` every
  element must itself be tagged.

- Failed numeric coercions must surface only as the `ValueError` with the exact message above, never
  as any other exception type: for example `'a'`, `'NaN'`, `'1.1'`, `-1.1` and `b'10'` for `int`,
  and `'a'` or `b'a'` for `float`.

## New Interfaces

No new interfaces are introduced. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
