A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Title: Support dual-format segment targeting in feature flag rules

## Description

The `segment` field in feature flag rule definitions currently only supports a single string key for
segment targeting. This limits rule expressiveness when users need to target multiple segments with
logical operators (e.g., AND/OR) within a single rule. Rules that require multi-segment targeting
have no unified way to represent both a simple single-segment reference and a compound multi-segment
grouping within the same configuration field. This inconsistency affects import, export, and
persistence of rule configurations across environments.

## Requirements

- The rule configuration must support a unified `segment` field that accepts two formats: a plain
  string for a single segment key, or an object containing a list of keys and a logical operator.

- The system must correctly serialize the `segment` field to YAML in both formats: a string value
  when a single segment key is used, and a nested object with `keys` (list) and `operator` (string)
  when multiple segments are used.

- The system must correctly deserialize the `segment` field from YAML, distinguishing between a
  plain string and an object with `keys` and `operator`.

- When creating or updating a rule with a single segment, the segment operator must default to
  `OR_SEGMENT_OPERATOR`.

- When creating or updating a rollout with a single segment, the segment operator must default to
  `OR_SEGMENT_OPERATOR`.

- Exporting a rule with a single segment must produce the string format for the `segment` field.
  Exporting a rule with multiple segments must produce the object format with `keys` and `operator`.

- Importing a configuration that uses the object format for the `segment` field must correctly map
  the keys and operator to the internal rule representation, including support for operators such as
  `AND_SEGMENT_OPERATOR` and `OR_SEGMENT_OPERATOR`.

- Configuration snapshot logic must correctly read and persist both segment representations,
  extracting keys and operator when the object format is used.

- When exactly one segment key is supplied, the stored/returned operator must be OR_SEGMENT_OPERATOR
  regardless of any operator in the request.

- The dual string/object `segment` format applies to rule definitions only. Rollout YAML keeps its
  existing `segment: {key: <segmentKey>, value: <bool>}` shape unchanged on import and export.

## New Interfaces

No new interfaces are introduced. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
