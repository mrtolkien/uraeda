---
status: active
approved-by: mrtolkien
icon: layers
---

# Stack

Uraeda's workflow logic is written once, in Rust, in one core. The CLI reaches it directly, the
server and the web UI through a Node binding, and editors through a language server. The server
commits and runs project code, so it stays on the user's machine, and [Sign-in](sign-in.md) says who
reaches it.

## Rules

- Workflow logic, parsing, validation, and states MUST live in the Rust core. Checked by review.
- TypeScript MUST reach the core only through the binding, never reimplementing it. Checked by
  review.
- The `ura` CLI MUST be Rust, needing no runtime. Checked by review.
- The server MUST be TypeScript on Node, and the web UI React with Astryx, the UI's design system,
  fed only by the server through fate, its data library. Checked by review.
- The web UI MUST draw workflow files from the core's document tree, never parsing their markdown.
  Checked by review.
- Editor plugins MUST reach workflow files only through `ura lsp`, the language server over the
  core. Checked by review.
- Completions and code actions MUST edit only the open document, leaving commits to a command the
  user runs. Checked by review.
- The server MUST stop every preview command it runs when it stops. Checked by the runner's tests.
- The server MAY run a checkout's active [preview](preview.md) command. Checked by the runner's
  tests.

## Why

The CLI is a small native binary, while agent SDKs and fate are TypeScript, so a binding shares one
core between them. A second parser would drift from the core's rules. Approving must be deliberate,
so an editor never commits from a code action. History:
[Stack decision](../done/2026-10-10-stack-decision.md).

## Alternatives considered

- All TypeScript, the CLI shipped with Bun: one toolchain, but an 80 MB binary.
- All Rust: no official agent SDKs, and fate only through GraphQL.
- The server or an editor plugin calling `ura --json`: one process per call, and edits outside the
  editor's undo.

## Consequences

- One parser and one validator serve every tool: a new markdown feature or editor action starts in
  the core.
- Contributors and CI need Rust and Node.
- fate stays pinned, since its custom sources use undocumented types.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
