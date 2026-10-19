---
kind: feature
finished: 2026-10-19
---

# Record: Default configuration validates against the CUE schema

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19. Its full files are in git: `git log -- specs/2026-10-19-flipt-cue-schema/`.

## What and why

The default Flipt configuration could drift from the CUE schema that documents it. A test now
decodes `DefaultConfig()` and validates it against `#FliptSpec` with every value concrete, so Flipt
maintainers get a failure when defaults and schema disagree.

## Behaviour

- **Default validates**: `DefaultConfig()` decoded with the exported `DecodeHooks`, durations and
  enums turned into strings by the test, validates against `#FliptSpec`. Durations stay
  `time.Duration` in the decoded map. `Load("./testdata/default.yml")` equals `DefaultConfig()`.
- **Storage by reference**: `StorageConfig.Local` and `Git` are `*Local` and `*Git`, nil unless that
  backend is selected, and omitted from the decoded map. Validating type `git` or `local` with a nil
  pointer returns the "must be specified" error, never a panic.
- **Database, git authentication, CORS**: the schema takes a database as a URL, or as protocol,
  host, and name (port and user optional), never both. Git authentication is basic or token, never
  both, or empty. CORS origins are a list or one string. Durations take the Go form, with decimals
  such as `1.5s`, or an integer.
- **Full example**: `advanced.yml` also loads audit (log sink on, `/path/to/logs.txt`, capacity 10,
  flush period 3m), an OTLP tracing exporter at `localhost:4318`, and git storage (ref `production`,
  poll interval 5s, basic authentication). Its `tracing.backend` line is gone.
- **Field names**: `fieldKey` returns the tag's name whatever its option, so `omitempty` tags bind
  the right environment variable. `Config.Version` decodes as `version`. Zero optional values and
  nil pointers are left out of the decoded map by `omitempty`.

## Design

The config package makes the decoded map mirror the schema, and the schema learns every section. No
dependency was added.

- [`DefaultConfig`, `DecodeHooks`, `fieldKey`](/internal/config/config.go): the defaults moved from
  the test helper, the exported hook list (`Load` appends its experimental hook to a copy), and the
  tag-to-name rule.
- [`StorageConfig`](/internal/config/storage.go): the "nil unless selected" rule and nil-safe
  validation.
- [`#FliptSpec`](/config/flipt.schema.cue): the contract, with a shared `#duration` and two-branch
  alternatives for the database and git authentication.
- [`config_test.go`](/internal/config/config_test.go): the schema test and its string adaptation
  (`stringifyForSchema`), kept out of production code.

The JSON schema twin was left unchanged and still lacks `storage`.

## Questions

### Round 01

#### Q1: Which fields must the schema require when the database is not given as a URL?

**Answer:** "your call, A": protocol, host, and name required; port and user optional.

#### Q2: Should the schema reject settings that mix the two alternatives?

**Answer:** "your call, A": reject both mixes, a URL with host fields, and basic with token.

#### Q3: Should `DefaultConfig()` keep an empty storage type, as the loaded default has?

**Answer:** "your call, A": keep it empty, omitted from the decoded map.

#### Q4: Should this feature adopt code-quality limits as a project decision?

**Answer:** "your call, A": no limits now, revisit on 2027-01-19.

## Decisions

- New: [Code quality](../decisions/code-quality.md): the project sets no size limits.

## Follow-ups

- The test that `Load` does not grow `DecodeHooks` cannot fail while the slice literal has no spare
  capacity; it only guards the length.
- No pull request was opened: `gh` is not installed here.
