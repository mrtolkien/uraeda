# Rulings: Technical stack decision

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Kebab-case string enum

- **Decision**: `Status` is exported with `#[napi(string_enum = "kebab-case")]`, instead of a
  `#[napi(value = "...")]` attribute on each variant.
- **Rationale**: inside `cfg_attr`, the variant attributes expand before the enum's `napi` macro
  reads them, and rustc rejects them as an unknown attribute macro. The case conversion gives the
  same values with one attribute.
- **Alternatives considered**: a `napi` module re-export, or mirror types in the binding crate: more
  code, or two declarations of each type.
- **If wrong**: a value that is not the kebab-case of its variant needs the per-variant attribute,
  outside `cfg_attr`.
- **Where**: task 1, `crates/core/src/temporary_status.rs`

## R2: fate's source built from its exported types, with casts

- **Decision**: the server's temporary source follows fate's own server tests: a `SourceDefinition`,
  a `Map` from it to `byIds` and `connection` handlers, and a `getSource` that returns it for every
  view. Two casts bridge types fate does not export (`SourceExecutor`, `AnyRecord`), and a mapped
  type turns napi-rs's generated `interface` into a type literal that fate's
  `Record<string, unknown>` constraint accepts.
- **Rationale**: every API used is exported from `@nkzw/fate/server`, and fate needs no patch, so
  the spec's fallback to Hono's typed client does not apply.
- **Alternatives considered**: the fallback, JSON routes with `hc` and TanStack Query: not needed.
- **If wrong**: a fate release that changes the source registry breaks the temporary source only;
  the web UI feature replaces it.
- **Where**: task 4, `packages/server/src/temporary-spec-folders.ts`

## R3: The guard reads the host from the request's URL

- **Decision**: the server's guard checks `new URL(context.req.url).host`, not the `Host` header.
- **Rationale**: `@hono/node-server` builds the URL from the `Host` header, so the check is the same
  in production; in the UI's tests, happy-dom drops a `Host` header set by hand, while the URL keeps
  it.
- **Alternatives considered**: reading the header, with the UI's tests sending requests outside
  happy-dom: more test plumbing for the same check.
- **If wrong**: a runtime that builds the URL from something else than `Host` would need the header
  check back; the table-driven guard test pins the behaviour.
- **Where**: task 5, `packages/server/src/guard.ts`

## R4: One fate server, with a request context

- **Decision**: `packages/server/src/fate.ts` exports a single `fateServer`. Each app sets, per
  request, a context whose `readSpecFolders()` reads its own specs folder, and the temporary source
  reads through it.
- **Rationale**: fate's Vite plugin imports the server module at build time and requires a value
  named `fateServer` or `fate`, so the server cannot be created per app with its options.
- **Alternatives considered**: a server created with a default specs path at import: it would read
  the wrong folder in tests and with `--specs`.
- **If wrong**: nothing outside the temporary source depends on the context's shape.
- **Where**: task 5, `packages/server/src/fate.ts`, `packages/server/src/app.ts`
