---
kind: change
finished: 2026-11-18
pull-request: https://github.com/mrtolkien/uraeda/pull/127
supersedes: []
---

# Record: Pages look like 1.4 again

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-18, finished on
> 2026-11-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/127). Its full files
> are in git: `git log -- specs/changes/2026-11-18-pages-look/`.

## What and why

After Uraeda light, the owner found `ura serve`'s pages "empty and boring and hard to read", and
asked for "almost the same look for reading specs and clarifications as uraeda 1.4", with a refresh
button on the home page. The binary stays light: the look is one style sheet, with no font and no
image added.

## Behaviour

- **The palette and the type are 1.4's**, on every page: its light and dark palettes from the
  system's setting, square corners, and titles, labels, and buttons in the system's monospace font
  over text in its sans font.
- **A frame's label is cut into its border**: "Example" and "Why it matters" on a question's boxes,
  whose paragraph no longer opens with the same words; an option's letter, with "★ Recommended"; a
  callout's kind. A picked option's label is filled, with a check.
- **At a desk, from 1080 px, an outline stands at the right** of a round and of a review. A round's
  shows the progress, a bar, and a link per question, an answered one marked and a follow-up not
  asked left out. A review's shows the file's `##` and `###` headings, then the comments and the
  verdict. The part being read is marked.
- **A phone has no outline**, and its question is no card: a line above it, its text at the page's
  width.
- **What a page is about stands over its title**, as a label: "Questions, round 1", "Spec to
  review".
- **"Refresh", beside the home page's title**, is a link to the page itself: it reads the
  repositories again, and works without the script.

## Design

The frames, the labels, and the outlines are drawn in Rust, so a page reads the same without its
script: [`round/view.rs`](../../crates/serve/src/round/view.rs) (`boxed`, `outline`),
[`review/view.rs`](../../crates/serve/src/review/view.rs) (`outline`, from the headings of the drawn
HTML), and [`waiting.rs`](../../crates/serve/src/waiting.rs) for the refresh link. The look is
[`ura.css`](../../crates/serve/assets/ura.css). The script,
[`ura.js`](../../crates/serve/assets/ura.js), keeps the round's outline with the answers and marks
the part being read (`follow`).

## Gotchas

- **A box's capital is the style sheet's**: the paragraph of a "Why it matters" box keeps its text
  as written, lowercase first, since an example may open on a command or a name, and
  [`ura.css`](../../crates/serve/assets/ura.css) capitalises its first letter on the page.
- **A label stands on the page's colour**, which cuts the frame's line: a frame over another
  background needs its label's background changed with it, as a picked option does.
- **A heading whose text has no letter or digit** has an empty `id`, and its outline link goes to
  the top of the page.

## Questions

### Round 01

Asked in the session.

#### Q1: How close to 1.4 should the round and spec pages get?

**Answer:** "All of it, system fonts": the palette, the framed boxes, and the desk's outline column,
with titles in the system's monospace font, where 1.4 embedded JetBrains Mono. No app sidebar, no
status bar.

## Changes after approval

- The settings, the sign-in, and the vault's page take the same palette and corners: the pages share
  one style sheet.
- The README's four page screenshots were taken again.
