A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

# Observation ordering helper, catalog accessor, label lookup, and persistence are missing

## Summary

The module `openlibrary/core/observations.py` must expose a value-name ordering helper, an accessor
for the observation types with their value names, a lookup from a type id and a value id to their
labels, and the storage and retrieval of a patron's observations for a work.

## Component Name

`openlibrary/core/observations.py`

## Steps to Reproduce

1. Read the observation types and their value names from the catalog accessor.

2. Resolve a type id and a value id to their label and value name.

3. Persist a patron's submitted observations for a work and read them back.

4. Order value names from a display-order list of value ids and a value list that is only partially
   aligned with it.

## Current Behavior

The module does not expose `_sort_values`, `get_observations`, `Observations.get_key_value_pair`,
`Observations.persist_observations`, or `Observations.get_patron_observations`.

## Expected Behavior

The module must expose the observation catalog with each type's value names in order, resolve a
stored type id and value id back to their catalog label and value name, and keep each patron's
stored observations for a work equal to their latest submission. The value-name ordering must remain
well-defined when the display-order list and the value list are not fully aligned.

## Requirements

- The module `openlibrary/core/observations.py` must expose an importable
  `_sort_values(order_list, values_list)` at the module level, where `order_list` is a sequence of
  integer ids and `values_list` is a sequence of `{id, name}` dictionaries. It must return the
  `name` of each value whose `id` appears in `order_list`, arranged in the order given by
  `order_list`. An id in `order_list` with no matching entry in `values_list` must be absorbed, and
  an entry in `values_list` whose `id` is absent from `order_list` must be excluded.

- `get_observations()` must return a dictionary holding an `observations` key whose value is a
  non-empty list. Each entry must be a dictionary exposing the keys `label`, `description`,
  `multi_choice`, and `values`, where `values` is a list of value-name strings. The entry whose
  `label` is `pace` must have `multi_choice` equal to `False` and `values` equal to
  `['slow', 'medium', 'fast']`. The entry whose `label` is `fictionality` must have `values` equal
  to `['nonfiction', 'fiction', 'biography']`.

- `Observations.get_key_value_pair(type_id, value_id)` must return an object exposing a `key`
  attribute holding the observation type label and a `value` attribute holding the value name, and
  iterating as the pair `(key, value)`. `get_key_value_pair(1, 1)` must return `key` equal to
  `'pace'` and `value` equal to `'slow'`. `get_key_value_pair(10, 7)` must return `key` equal to
  `'genres'` and `value` equal to `'mystery'`.

- `Observations.persist_observations(username, work_id, observations)`, where `observations` is a
  list of single-entry `{label: value_name}` dictionaries, must store the patron's observations for
  the work so that the patron's stored set for that work equals the submitted set, leaving other
  works and other patrons unchanged: a submitted value that is not stored must be inserted, a stored
  value that is absent from the submission must be removed, and a value present in both must remain
  without duplication. Stored rows must use the keys `observation_type`, `observation_value`,
  `username`, and `work_id`.

- `Observations.get_patron_observations(username, work_id)` must return the patron's stored
  observations for the work as a list of records, each supporting item access `record['type']`
  holding the observation type id and `record['value']` holding the value id.

## New Interfaces

- Path: `openlibrary/core/observations.py`
- Name: `get_observations`
- Type: function
- Input: none
- Output: a dictionary holding an `observations` key whose value is a list of dictionaries, each
  exposing the keys `label`, `description`, `multi_choice`, and `values`, where `values` is a list
  of value-name strings
- Description: returns the observation types with their value names

- Path: `openlibrary/core/observations.py`
- Name: `Observations`
- Type: class
- Input: none
- Output: none
- Description: groups the observation lookup and persistence classmethods `get_key_value_pair`,
  `persist_observations`, and `get_patron_observations`

- Path: `openlibrary/core/observations.py`
- Name: `Observations.get_key_value_pair`
- Type: classmethod
- Input: `type_id`, an integer observation type id; `value_id`, an integer value id
- Output: an object exposing a `key` attribute holding the observation type label and a `value`
  attribute holding the value name, iterating as the pair `(key, value)`
- Description: resolves a type id and a value id to their observation type label and value name

- Path: `openlibrary/core/observations.py`
- Name: `Observations.persist_observations`
- Type: classmethod
- Input: `username`, a string; `work_id`, a string; `observations`, a list of single-entry
  `{label: value_name}` dictionaries
- Output: none
- Description: stores a patron's observations for a work so that the stored set for the work matches
  the submitted set, inserting submitted values that are not stored and removing stored values that
  are not submitted

- Path: `openlibrary/core/observations.py`
- Name: `Observations.get_patron_observations`
- Type: classmethod
- Input: `username`, a string; `work_id`, a string
- Output: a list of records, each supporting item access `record['type']` holding the observation
  type id and `record['value']` holding the value id
- Description: returns a patron's stored observations for a work

</pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
