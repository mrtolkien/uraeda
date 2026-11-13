---
icon: layers
---

# Stack

> "The frontend can be mostly independent, logic should live in the CLI and backend."
>
> "I'd like to share code between CLI and backend to not re-implement the same logic twice."

Today the CLI and the backend, the server, are one Rust binary, `ura`, over one Rust library, the
core. The frontend is the app. Workflow logic is whatever reads a workflow file or decides about it:
its format, its state, its problems, and what may be done next.

## Rules

- Workflow logic lives once, in the Rust core: parsing, validation, and states. _So:_ the server
  never tells one of the core's problems from another by reading its message's text: the core says
  which it is.
- The app holds no workflow logic: what it shows, and what it may do, come from the server. _So:_
  the Home page's "Continue all" waited until the server said which runs can continue. A button
  deciding that itself would guess.
- The server and the CLI are Rust, in the one `ura` binary, and call the core directly. _So:_ an
  extension's TypeScript runs in a VM inside the server. No second server process is added, and no
  binding between two languages.
- The app is TSX on Native Shell (NSH), a framework that draws one codebase natively and in a
  browser. _So:_ a page is written once for every platform the app ships on. A React page, or a
  second UI codebase, changes this decision first.

## Why

A rule written twice drifts: two readers disagree on the same file, and the wrong one looks right.
With the logic in one core, the CLI, the server, and the app give one answer. One binary leaves
nothing between the server and the core, and nothing else to install. NSH gives native apps and a
web app from the same pages. History: [Stack decision](../done/2026-10-10-stack-decision.md).

## Alternatives considered

- A TypeScript server on Node with a React UI, the earlier stack. It needed a binding between two
  languages and a runtime to install, and gave no native app.
- An app written all in Rust: measured no faster to draw than TSX, and slower to write.

## Applies to

- [`crates/`](/crates/) and [`app/`](/app/), and every feature that adds logic, a command, a record,
  an action, or a page
