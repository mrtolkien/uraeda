---
kind: change
finished: 2026-10-31
pull-request: https://github.com/mrtolkien/uraeda/pull/78
supersedes: [2026-10-30-inbox-again]
---

# Record: Mockup previews

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-31, in [its pull request](https://github.com/mrtolkien/uraeda/pull/78). Its full files are
> in git: `git log -- specs/changes/2026-10-30-mockup-previews/`.

## What and why

The human found that the performance pass's spec showed none of its story mockups locally, and that
an SVG could not be previewed: a round comparing three README banners linked its SVG prototypes,
which only opened in a new tab, and an SVG could not show in a proposal. They asked for the mockups
to work, and for SVG and PNG files to show in sessions and in pages: specs, questions, and the rest.

## Behaviour

- **A new worktree's stories show**: Uraeda's Storybook builds the native binding first when the
  worktree has none, as after its install alone, then starts. Before, every story of such a branch
  failed with "Storybook did not start: └ Storybook exited with an error", which Try again could not
  fix. A stale binding is rebuilt as before; outside a checkout, the npm package's, nothing builds.
- **A Storybook that fails to start says why**: the embed names the last line of its output that
  names an error, of any kind (`Error`, `SyntaxError`, `TypeError`), without Storybook's frame, else
  its last line; a process that printed nothing ends with its exit code or signal, as before.
- **A committed SVG under `specs/` shows as an image**: `![alt](mockups/banner.svg)` draws in place,
  as PNG, JPEG, GIF, and WebP files there already did. The file shows when it is named `.svg` and
  its first element is `<svg`, after a declaration, comments, and a doctype with its internal
  subset. Attaching an SVG is still refused, and images outside `specs/` still do not draw.
- **A prototype's image shows where it is linked**: a paragraph holding only a link to a PNG, JPEG,
  GIF, WebP, or SVG file in a `mockups/` folder under `specs/` draws the image, its link text as its
  alt text, its text marked or not, as a link alone to an HTML page there is drawn live. A link to
  an image inside a sentence, or elsewhere, stays a link.
- **An agent's images show in its messages**: in a session, an image or such a link alone is read
  from the repository root, with or without a leading `/`, as story links are, and draws from the
  repository; a web image still loads from the web.
- **An SVG runs nothing**: drawn in a page, it is an `<img>`; opened alone in a tab, it is served as
  `image/svg+xml`, never sniffed, with `default-src 'none'; style-src 'unsafe-inline'; sandbox`, so
  no script runs and nothing loads, while its own styles, like a dark mode, still draw it.
- **The sandbox shows them**: the round mockup feature's options A and C show an SVG prototype each,
  one linked alone and one as an image, and a sample chat shows both.

## Design

Root causes and approaches, by item:

- **Stories in a new worktree**: Storybook runs Uraeda's real server over a fixture, so reading its
  config loads the native binding. [`freshBinding`](/packages/server/src/binding.ts) rebuilt a stale
  binding but left a missing one alone, and only `vp run dev` built one. It now builds a missing
  binding too, through `vp run binding:touch`, and
  [Storybook's config](/packages/web/.storybook/main.ts) imports it first, as the Vite configs did.
  A cold build takes about 20 seconds with the seeded `target/`, inside the runner's 2 minutes;
  building in the preview decision's `preview-command` would have changed an active decision.
- **The failure's sentence**: the runner gave the last line of output, and Storybook's is always its
  closing line. [`lastReason`](/packages/server/src/preview/process.ts) strips the frame's box
  drawing and picks the last error line. The [fake Storybook](/fixtures/preview/serve.mjs)'s `fail`
  mode prints its error framed as Storybook does.
- **SVG images**: [`images::is_svg`](/crates/core/src/images.rs) recognises a drawing, and
  [`read_image`](/crates/core/src/api/files.rs) returns it as `image/svg+xml` when no raster
  signature matches. The [image route](/packages/server/src/files.ts) gives SVGs their own policy.
  The encoder, which attaching goes through, is unchanged and still refuses SVG.
- **Prototypes in pages**: [`Spans`](/packages/web/src/Spans.tsx) draws a link alone to a
  prototype's image with `ImageView`, reading a link alone as the core's embeds do;
  [`Blocks`](/packages/web/src/Blocks.tsx) makes such a paragraph a box, as for any image, since the
  lightbox cannot sit in a `<p>`. The "in a `mockups` folder" rule is
  [`inMockups`](/packages/web/src/links.tsx), shared with the mockup links.
- **Images in sessions**: Astryx's markdown gave a repository path to `<img>` as written, which the
  page's address broke. [`AgentStories`](/packages/web/src/AgentStories.tsx) gains an `image`
  component and draws a prototype's link alone.
- **The skill** says how a prototype and its images show, in
  [conventions](/skills/uraeda/references/conventions.md) and
  [discovery](/skills/uraeda/references/discovery.md).
- **The sandbox**: the [round mockup fixture](/fixtures/round-mockup/clarifications-01.md) and its
  two SVGs, the sample project's [builder](/packages/web/samples/projects.ts), and the
  [sample chats](/packages/web/sandbox/sessions.ts).

## Gotchas

- **Serving SVG reads the attachments decision's rule as covering attachments**:
  [attachments](/specs/decisions/attachments.md) says "The core MUST refuse image types that can
  carry code, such as SVG". The encoder still refuses one, but the core's image read now returns
  one, so the rule read literally is contradicted: left for the human to arbitrate on the pull
  request.
- **The performance pass's own failure was not seen**: its worktree was gone. A worktree without a
  built binding gives exactly "nothing shows", and the performance pass's stories render once the
  binding is built, from a copy of its branch's last commit.
- **A merged record's links fixed here**: the inbox-again record linked three proposals of **Now**
  at their `specs/proposals/` paths, which their starts moved, so `ura check specs` failed on main
  and stopped the full validation. Its links point to the started folders.

## Follow-ups

- Agents' notes in the inbox, under **Deferred fixes**: a percent-encoded image path in a session's
  message, a doctype in mixed case or closed as `] >`, an SVG's colour scheme in Firefox following
  the OS rather than Uraeda's theme, and a clicked SVG link opening through the mockup route, whose
  policy lets scripts run.
- Attaching an SVG, as by pasting it into a proposal, is still refused: making it possible, for
  example by turning it into a WebP, needs the attachments decision changed.
