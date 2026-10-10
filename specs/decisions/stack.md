---
status: proposed
approved-by:
---

# Stack

Uraeda's workflow logic is written once, in Rust, in a core crate. The `ura` CLI is a Rust binary
built on it. The server is a TypeScript program on Node that calls the same core through a napi-rs
binding, and the web UI is React with Astryx and fate, fed by the server. TypeScript never
reimplements what the core does, and the types that cross from Rust are generated, never written by
hand.

## Rules

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/).
- The CLI MUST be written in Rust, in [`crates/cli`](/crates/cli/), build the binary `ura`, and MUST
  NOT need Node or any other runtime to run.
- The server MUST be written in TypeScript, run on Node, and live in
  [`packages/server`](/packages/server/).
- TypeScript code MUST reach the core only through the binding,
  [`packages/binding`](/packages/binding/), and MUST NOT reimplement its parsing, validation, or
  states.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript.
- The web UI MUST use React, Astryx components, and fate, live in [`packages/web`](/packages/web/),
  and get its data only from the server, through fate.
- The server MUST listen on 127.0.0.1 only, and MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or whose `Origin`, when present, is not an allowed origin.

## Why

The CLI must install without a package manager, as a small native binary, and the human prefers
Rust's enums and cargo workspaces for workflow states. The server drives agents whose official SDKs,
and pi-durable, are TypeScript, and fate assumes a TypeScript server. A napi-rs binding lets both
share one core without a second parser
([Q1](../2026-10-10-stack-decision/clarifications-01.md#q1-which-language-for-each-component),
[Q2](../2026-10-10-stack-decision/clarifications-01.md#q2-how-do-the-backend-and-the-ui-reach-users),
[Q3](../2026-10-10-stack-decision/clarifications-01.md#q3-where-are-workflow-files-parsed-and-validated),
[language split](../2026-10-10-stack-decision/discovery-01.md#language-split)). The server will
commit to git and start agents, so a web page the user visits must not reach it
([local server security](../2026-10-10-stack-decision/discovery-01.md#local-server-security)).

## Alternatives considered

- All TypeScript, the CLI shipped with Bun: one toolchain, but an 80 MB binary.
- Rust for the core, the CLI, and the server: one 2.7 MB binary, but no official agent SDKs, and
  fate only through GraphQL.
- A TypeScript server calling the CLI with `--json`: no binding, but the server reaches the logic
  only through the CLI's output, one process per call.

## Consequences

- One parser and one validator, in Rust, for the CLI, the server, and the UI.
- The CLI stays small, and the server uses the official Claude Code and Codex SDKs, fate, and
  pi-durable in process.
- Two toolchains: every contributor and CI need Rust and Node, and the binding must be built before
  the TypeScript tests run.
- Shipping the server means shipping a native addon per platform, or a container image.
- Every core type the TypeScript side uses must be expressible through napi-rs.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
