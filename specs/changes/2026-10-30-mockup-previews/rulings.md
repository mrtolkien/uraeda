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
- **Rationale**: the [attachments](../../decisions/attachments.md) decision's rule "The core MUST
  refuse image types that can carry code, such as SVG" is read here as refusing them as attached
  images, the decision's subject, which it still does. Read literally, the core's image read now
  takes one: the human arbitrates that conflict on the pull request. A drawn `<img>` never runs an
  SVG's scripts, and opened alone in a tab, the policy runs none and loads nothing, while its own
  styles still draw it, as the dot banners' `<style>` and dark mode need.
- **Alternatives considered**: images anywhere in the repository, not only under `specs/`: the
  route's test pins `specs/`, and prototypes and attachments all live there.
- **If wrong**: drop the `or_else` in `read_image`: SVGs show as "Image missing" again.
- **Where**: `crates/core/src/images.rs`, `crates/core/src/api/files.rs`,
  `packages/server/src/files.ts`

## R3: A link alone to a prototype's image draws the image, in pages and sessions

- **Decision**: a paragraph holding only a link to a PNG, JPEG, GIF, WebP, or SVG file in a
  `mockups/` folder under `specs/`, its text marked or not, draws the image, its link text as its
  alt text, as a link alone to an HTML page there already drew it live. In an agent's message, an
  image or such a link is read from the repository root, with or without its leading `/`, as story
  links are. A web image in a message still loads from the web, as Astryx's markdown drew it.
- **Rationale**: the skill has discoveries link each prototype alone in its paragraph, whatever its
  format, and only HTML ones showed: the README banners' SVG options were three links to click.
  Agents' markdown gave a repository path to `<img>` as it was, which the page's own address broke.
- **Alternatives considered**: drawing a link alone to any image of the repository: a document's
  links to screenshots would turn into images unasked.
- **Where**: `packages/web/src/Spans.tsx`, `packages/web/src/AgentStories.tsx`, and the sandbox's
  round mockup, whose options A and C show an SVG prototype each, with a sample chat showing both
