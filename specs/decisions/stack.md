---
icon: layers
---

# Stack

> "The frontend can be mostly independent, logic should live in the CLI and backend."
>
> "I'd like to share code between CLI and backend to not re-implement the same logic twice."

Today the CLI and the backend are one Rust binary, `ura`, over one Rust library, the core. The
backend is `ura serve`, and the frontend is its pages and the vault's Obsidian plugin. Workflow
logic is whatever reads a workflow file or decides about it: its format, its state, its problems,
and what may be done next.

## Rules

- Workflow logic lives once, in the Rust core: parsing, validation, and states. _So:_ `ura next`,
  `ura status`, and the page of what waits read every feature from the core's one reading of the
  repository, and the pages never tell one of the core's problems from another by reading its
  message's text.
- The pages and the plugin hold no workflow logic: what they show, and what they may do, come from
  `ura`. _So:_ an answer written on a round that changed since is refused by `ura`, not by the
  page's script, and the desktop decides every sync's plan, which the phone's plugin only carries
  out.
- Everything runs in the one `ura` binary, in Rust, and calls the core directly. _So:_ no second
  process, no Node, and no binding between two languages: the plugin is plain JavaScript with no
  build step, which `ura` embeds.
- The pages are HTML drawn in Rust, with plain JavaScript and CSS embedded in the binary: no
  framework, no build step, and nothing fetched from outside. _So:_ a diagram is drawn in Rust as an
  inline SVG. A React page, or a page built by a bundler, changes this decision first.

## Why

A rule written twice drifts: two readers disagree on the same file, and the wrong one looks right.
With the logic in one core, the CLI, the pages, and the sync give one answer. One binary leaves
nothing between the pages and the core, and nothing else to install. Pages drawn on the server are
fast on a phone and need no toolchain of their own. History:
[Stack decision](../done/2026-10-10-stack-decision.md).

## Alternatives considered

- A TypeScript server on Node with a React UI, the 1.x stack. It needed a binding between two
  languages and a runtime to install.
- An app on Native Shell over a Rust server, the 2.x stack: native and web from one codebase, but
  most of the code Uraeda had, for screens other tools now give.
- An Obsidian plugin that draws rounds and reviews, and Plannotator: tried in spikes before Uraeda
  light, and dropped for pages of `ura`'s own.

## Applies to

- [`crates/`](/crates/), and every feature that adds logic, a command, a page, or a change to the
  sync
