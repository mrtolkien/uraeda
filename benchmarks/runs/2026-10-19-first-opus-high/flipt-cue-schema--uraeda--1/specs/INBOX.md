# Inbox

## Configuration

- [agent] [flipt-cue-schema] Port the CUE schema's changes to `config/flipt.schema.json`: storage,
  experimental, the Kubernetes method, the session lifetimes and CSRF key, OIDC scopes, the two
  database forms, and the duration pattern. Until then, editors flag valid settings
- [agent] [flipt-cue-schema] A fully populated configuration fails the CUE schema: OIDC providers
  sit in a map of structs, which mapstructure copies as is, so CUE sees their JSON names, such as
  `clientID`, instead of `client_id`

## Deferred fixes

- [agent] [flipt-cue-schema] The schema test case "db url and host" also fails because the host form
  lacks `protocol` and `name`, so it would pass if the host form allowed `url`: give it a complete
  host form plus `url`
- [agent] [flipt-cue-schema] `internal/config/testdata/advanced.yml` has two blank lines between its
  storage and audit sections
