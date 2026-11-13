---
icon: layers
---

# Stack

> "The workflow's rules are written once."

The workflow logic lives in one Rust core. The CLI reaches it directly, the server and the web UI
through a Node binding, and editors through a language server.

## Rules

- Workflow logic, parsing, validation, and states live in the Rust core, and TypeScript reaches it
  only through the binding. _So:_ the web UI draws a workflow file from the core's document tree.
- The `ura` CLI is Rust, needing no runtime. _So:_ it installs as one binary.
- Editor plugins reach workflow files only through `ura lsp`, and its code actions never commit.
  _So:_ approving stays a command the user runs.
- The server stops every preview command it runs when it stops. _So:_ no Storybook outlives it.

## Why

The CLI is a small native binary, while agent SDKs are TypeScript, so a binding shares one core
between them. A second parser would drift from the core's rules. History:
[Stack decision](../done/2026-10-10-stack-decision.md).

## Alternatives considered

- All TypeScript, the CLI shipped with Bun: one toolchain, but an 80 MB binary.
- All Rust: no official agent SDKs.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
