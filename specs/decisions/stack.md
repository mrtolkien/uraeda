---
status: proposed
approved-by:
icon: layers
---

# Stack

Uraeda's workflow logic is written once, in Rust, in one core. The CLI and the server reach it
directly, inside one `ura` binary, clients reach the server through the [protocol](protocol.md), and
editors through a language server. The server commits and runs project code, so it stays on the
user's machine, and [Sign-in](sign-in.md) says who reaches it.

## Rules

- Workflow logic, parsing, validation, and states MUST live in the Rust core.
- The server MUST be Rust, inside the `ura` binary, reaching the core directly.
- The `ura` CLI MUST be Rust, needing no runtime.
- The UI MUST be TSX on Native Shell (NSH), a framework that draws one codebase natively and in a
  browser, fed only by the server through the protocol.
- The UI MUST hold no workflow logic: what it shows, and what it may do, come from the server.
- Editor plugins MUST reach workflow files only through `ura lsp`, the language server over the
  core.
- Completions and code actions MUST edit only the open document, leaving commits to a command the
  user runs.
- The server MUST stop every preview command it runs when it stops. Checked by the server's tests.
- Heavy UI logic, such as parsing, diffing, and modal keys, SHOULD be Rust modules called from TSX.
- The server MAY run a checkout's active [preview](preview.md) command. Checked by the server's
  tests.

## Why

One binary holds the CLI and the server, so nothing sits between the server and the core. NSH draws
the same TSX natively and in a browser. Components stay TSX: they draw as fast as Rust ones, reload
on save, and are shared with extension pages. Heavy logic is Rust, since TSX runs in an interpreter.
Approving must be deliberate, so an editor never commits from a code action. History:
[Stack decision](../done/2026-10-10-stack-decision.md).

## Alternatives considered

- A TypeScript server on Node with a React UI, the earlier stack: a binding between two languages, a
  runtime to install, and no native client.
- Exact, another native framework: no window on a Linux desktop, and streams that drop messages.
- A UI all in Rust: measured no faster to draw than TSX, and slower to write.

## Consequences

- One parser and one validator serve every tool: a new markdown feature or editor action starts in
  the core.
- Contributors and CI need Rust and NSH's tools.
- NSH stays pinned, since its Rust API changes between releases.
- Agent SDKs are TypeScript, so the server runs `claude` and `codex` as processes.

## Applies to

- [`crates/`](/crates/) and `app/`, and every feature that adds logic, a command, a record, an
  action, or a page
