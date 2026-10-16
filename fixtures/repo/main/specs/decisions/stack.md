---
status: active
approved-by: mrtolkien
icon: layers
---

# Stack

Uraeda's workflow logic is written once, in Rust, in a core crate. The server is a TypeScript
program on Node that calls the same core through a napi-rs binding.

## Rules

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core. Checked by
  review.
- TypeScript code MUST reach the core only through the binding. Checked by review.

## Why

One implementation of the workflow's rules, for every tool.

## Consequences

- A change to the rules is made once, in Rust.

## Applies to

- The core, the CLI, the server, and the web UI
