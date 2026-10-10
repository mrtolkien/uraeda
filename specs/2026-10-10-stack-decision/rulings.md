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
