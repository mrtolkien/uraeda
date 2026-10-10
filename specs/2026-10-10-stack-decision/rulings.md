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
