# Rulings: Remove size from public image ID JWT

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Lint every package but `core/agents`, with Go 1.19

- **Decision**: the lint step of each task, and SC-004, run golangci-lint with the repository's
  `.golangci.yml` and the version `make lint` pins, under a Go 1.19 toolchain, skipping
  `core/agents`:
  `PATH=<go1.19>/bin:$PATH GOTOOLCHAIN=local GOFLAGS=-buildvcs=false go run github.com/golangci/golangci-lint/cmd/golangci-lint run --timeout 5m --skip-dirs '^core/agents$'`.
  Go 1.19.13 comes from [go.dev/dl](https://go.dev/dl/), outside the repository.
- **Rationale**: `make lint` fails on `main` before any change. golangci-lint v1.50.1 panics with
  "unsupported version: 2" under Go 1.20 and later, and under Go 1.19 its `typecheck` fails on
  `core/agents/agents_test.go`, which uses `placeholderBiography` and three
  `placeholderArtistImage*Url` names no longer defined anywhere. The command above passes on the
  branch before the feature, with every linter enabled, so it checks what `make lint` would.
- **Alternatives considered**: fixing `core/agents/agents_test.go`, or upgrading golangci-lint: both
  change files outside the feature, and the second reconfigures the linters, which the
  [code-quality decision](/specs/decisions/code-quality.md) forbids without a human asking. Both are
  noted in the inbox, under Tooling, for a separate change.
- **If wrong**: a lint issue in `core/agents` goes unseen; the feature does not touch that package.
- **Where**: the lint step of every task.

## R2: Read the token from the path, without `URLParamsMiddleware`

- **Decision**: the public endpoint reads the token with `chi.URLParam(r, "jwt")`, and its router no
  longer uses `server.URLParamsMiddleware`, which only copied the path's token into the query.
- **Rationale**: the middleware appends `:jwt` after the client's query, and `Query().Get` returns
  the first value, so a client's own `?:jwt=` was read in place of the path's token. With the size
  in the query, the query is now the client's input; the token stays in the path, where the
  signature covers it.
- **Alternatives considered**: keeping the middleware and reading `:jwt` from the query, as today:
  keeps the ambiguity for no gain.
- **If wrong**: nothing else on the public router reads the query's `:jwt`; restoring the middleware
  is one line.
- **Where**: task 2, `server/public/public_endpoints.go`.

## R3: The first failure of task 2 is a 404, not a size

- **Decision**: task 2's run step expects `Expected <int>: 404 to equal <int>: 200`, in place of the
  size mismatch the plan first gave.
- **Rationale**: today's `validator` requires a `size` claim, so every token from `EncodeArtworkID`
  is refused before the handler reads a size. The `:jwt` spec panics instead: the validator passes a
  nil token to `jwt.Validate`, which dereferences it. `DecodeArtworkID` checks for a nil token
  first, so the panic is gone with the validator.
- **Alternatives considered**: none; the tests stay as planned.
- **If wrong**: nothing: it describes the old code's failure only.
- **Where**: task 2, step 2.
