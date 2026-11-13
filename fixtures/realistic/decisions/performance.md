---
icon: gauge
---

# Performance

> "Pages should simply all draw in 100 ms."

A target to keep, not a hard limit, on the machine Uraeda runs on.

## Rules

- The server answers reads from what it already read, reading git again only for what changed.
  _So:_ opening a page never waits on git for what git already said.
- The browser keeps the data of the pages it has shown, and reads the selected row's page ahead.
  _So:_ a key reaches a page as fast as a click.
- A page shows no loading state for what the server and the browser already hold. _So:_ no pending
  bar on a page seen before.
- A commit's hooks and an agent's work may take longer, as long as their progress shows. _So:_ a
  slow hook shows its output.

## Why

Rebuilding the workspace from every branch takes about 95 ms on this repository, and a page chains 2
to 4 reads, so a page that asks git again cannot draw within 100 ms. History:
[Performance pass](../done/2026-10-29-performance-pass.md).

## Alternatives considered

- The browser keeping data on disk across reloads: a new dependency, and a first frame that may show
  data a moment old.

## Applies to

- [`crates/core/`](/crates/core/), [`packages/server/`](/packages/server/), and
  [`packages/web/`](/packages/web/), and every feature that adds a page, a read, or a write
