# Rulings: Mockup previews

The low-impact choices made while building [the proposal](proposal.md), inside its limits and the
decisions. None binds future work: those are decisions.

## R1: Storybook builds a missing binding as it starts

- **Decision**: Uraeda's Storybook config builds the native binding first when the worktree has
  none, as `freshBinding` already rebuilt a stale one, through `vp run binding:touch`.
- **Rationale**: Storybook runs Uraeda's real server, which loads the binding as Storybook reads its
  config. A worktree that only ran its install has no binding, so every story of its branch failed
  with "Storybook did not start: └ Storybook exited with an error". A cold build takes about 20
  seconds with the seeded `target/`, inside the runner's 2 minutes.
- **Alternatives considered**: building in the [preview](../../decisions/preview.md) decision's
  `preview-command`: a change to an active decision, and every start would pay for the build's
  check.
- **If wrong**: a worktree without a seeded `target/` may take more than 2 minutes to build; its
  embed then fails once, and Try again finds the build in cargo's cache.
- **Where**: `packages/server/src/binding.ts`, `packages/web/.storybook/main.ts`

## R2: A committed SVG under `specs/` is served as an image, and still never attached

- **Decision**: the image route serves an SVG file under `specs/`, such as a prototype in a
  feature's `mockups/`, as `image/svg+xml`, with
  `default-src 'none'; style-src 'unsafe-inline'; sandbox`. The core reads it as a drawing only when
  it is named `.svg` and its first element is `<svg`. Attaching an SVG is still refused.
- **Rationale**: the [attachments](../../decisions/attachments.md) decision refuses SVG as an
  attached image, since it can carry code. A drawn `<img>` never runs an SVG's scripts, and opened
  alone in a tab, the policy runs none and loads nothing, while its own styles still draw it, as the
  dot banners' `<style>` and dark mode need.
- **Alternatives considered**: images anywhere in the repository, not only under `specs/`: the
  route's test pins `specs/`, and prototypes and attachments all live there.
- **If wrong**: drop the `or_else` in `read_image`: SVGs show as "Image missing" again.
- **Where**: `crates/core/src/images.rs`, `crates/core/src/api/files.rs`,
  `packages/server/src/files.ts`
