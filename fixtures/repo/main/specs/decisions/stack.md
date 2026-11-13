---
icon: layers
---

# Stack

> "The workflow's rules are written once."

The workflow logic lives in a Rust core crate. The server is a TypeScript program on Node that calls
the same core through a napi-rs binding.

## Rules

- Workflow logic, parsing, validation, and workflow states live in the Rust core. _So:_ the server
  never parses a spec's frontmatter itself.
- TypeScript reaches the core only through the binding. _So:_ no second parser in TypeScript.

## Why

One implementation of the workflow's rules, for every tool.

## Applies to

- The core, the CLI, the server, and the web UI
