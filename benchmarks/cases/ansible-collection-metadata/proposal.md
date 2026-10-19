A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title: Collection operations repeatedly fetch the same metadata

### Description

Currently, installing or downloading collections can repeatedly retrieve the same server metadata
while resolving available versions and dependencies, causing unnecessary network work and making
collection operations slower than needed.

## Requirements

- Collection install and download should offer a way to skip using any existing cached server
  responses, and a separate way to discard existing cached responses before execution continues;
  these map to `no_cache`, defaulting to `True`, and `clear_response_cache`, defaulting to `False`,
  on the `GalaxyAPI` initializer, whose cache lifecycle effects should apply on every construction,
  including when no galaxy context is supplied.

- The cache location should be taken from the configured `GALAXY_CACHE_DIR` value read at the moment
  the initializer runs, so an overridden default is honored rather than a value captured once at
  import time; the cache is a single store, named `api.json`, located directly under that directory,
  shared across Galaxy servers and not separated per server.

- With the default `no_cache=True`, a freshly built `GalaxyAPI` should hold no in memory cache (its
  `_cache` attribute should be `None`) and should not create, read, or alter the `api.json` store
  under `GALAXY_CACHE_DIR`.

- When `no_cache=False`, the directory named by `GALAXY_CACHE_DIR` should be created with mode
  `0o700` when missing before any cache access, and when the `api.json` store does not yet exist it
  should be created as a JSON object containing only a version field set to `1`, with mode `0o600`.

- When `no_cache=False` and the `api.json` store already exists, a valid JSON object whose top level
  version field equals `1` should be left untouched in both content and permissions, including when
  its permissions are `0o655`; otherwise the content should be rewritten in place to a JSON object
  containing only a version field set to `1`, preserving the existing permissions such as `0o664`
  without applying any mode change.

- When the `api.json` store has any world writable bit set, as with permissions `0o666`, a single
  warning should be emitted with the exact text
  `Galaxy cache has world writable access (<path>), ignoring it as a cache source.` where `<path>`
  is the full path to the store file; the content and permissions should remain unchanged, and the
  resulting `GalaxyAPI` should hold no in memory cache (its `_cache` attribute should be `None`).

- When `clear_response_cache=True`, any existing `api.json` store should be removed before any other
  cache action, regardless of `no_cache`; afterward, with `no_cache=False` it should be recreated as
  a JSON object containing only a version field set to `1`, with mode `0o600`, and with
  `no_cache=True` it should remain absent.

- A module-level `get_cache_id` helper should turn a URL into a string that joins the hostname and
  the port with a colon separator, stripping any embedded credentials from the hostname and
  rendering the port as its decimal value when a valid integer port is present or as an empty value
  otherwise, while always keeping the colon separator present.

- The `api.json` store must be written with `json.dumps` default formatting, so a freshly created or
  reset store contains exactly the bytes `{"version": 1}` (no indent, no trailing newline).

- The world-writable warning must be emitted exactly once via `display.warning(msg)` with the
  message as the sole positional argument.

- During construction, the `warning` method of `Display` must be called exactly once, and only for
  the world-writable case; no other cache diagnostic may go through that method.

- `GALAXY_CACHE_DIR` must be a registered configuration setting present in the base configuration
  definitions (`C.config._base_defs`) with a usable default directory path, so that
  `GalaxyAPI(None, "test", "https://galaxy.ansible.com/api/")` can be constructed with no galaxy
  context and no explicit cache configuration.

## New Interfaces

- Path: `lib/ansible/galaxy/api.py`
- Name: `get_cache_id`
- Type: function
- Input: url: str
- Output: str
- Description: Returns a cache identifier for the given URL by joining its hostname and port with a
  colon, omitting any embedded credentials and rendering a missing or invalid port as empty.
  </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
