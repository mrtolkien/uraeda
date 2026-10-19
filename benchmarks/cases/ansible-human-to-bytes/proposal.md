A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: The `human_to_bytes` filter converts malformed size strings instead of rejecting them.

### Description

The `human_to_bytes` filter returns a number for strings that are not valid size values, so a caller
that passes a malformed size receives a plausible result rather than an error.

Text that follows a number and a unit is discarded, so `10 BBQ sticks please` returns `10` and
`1 EBOOK please` returns `1152921504606846976`. A unit is accepted whenever it merely contains the
word `byte` or starts with a size letter, so `3 prettybytes` returns `3377699720527872`. A character
that is not an ASCII digit truncates the number instead of rejecting it, so `12,000 MB` returns
`12`, and a value carrying a zero-width space between its digits loses everything after it. Digits
outside the ASCII range are treated as numeric, so `8𖭙B` returns `89` and `᭔ MB` returns `4194304`,
and a value preceded by an ogham space mark is converted as though it had been written in ASCII.
Leading whitespace is skipped, so a string consisting only of spaces and a number is converted.

Only a properly formed number, optionally followed by a recognized unit, is a valid size value;
every other input reaches the caller as a number.

## Requirements

- When the string is not an ASCII decimal number optionally followed by ASCII spaces, a unit word,
  and trailing ASCII spaces, `human_to_bytes` must raise a `ValueError` whose message contains
  `can't interpret following string`.

- When the numeric part is written with digits outside the ASCII range, `human_to_bytes` must raise
  a `ValueError` whose message contains `can't interpret following string`.

- When the string begins with a whitespace character of any kind, `human_to_bytes` must raise a
  `ValueError` whose message contains `can't interpret following string`.

- When the unit is longer than one character and its first character is one of the recognized size
  prefixes, but the complete unit is neither that prefix's abbreviation nor its full-word name,
  `human_to_bytes` must raise a `ValueError` whose message contains `Value is not a valid string`.

- When the unit's first character is not one of the recognized size prefixes, `human_to_bytes` must
  raise a `ValueError` whose message contains `The suffix must be one of`.

## New Interfaces

No new interfaces are introduced.

</pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
