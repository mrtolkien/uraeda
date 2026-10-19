---
status: active
approved-by: mrtolkien
icon: layers
---

# Stack

Uraeda's workflow logic is written once, in Rust, in one core. The CLI reaches it directly, the
server and web UI through a Node binding, and editors through a language server. The server commits
and runs project code, so it stays local. It refuses every page but Uraeda's own and the frames it
gave a secret.

## Rules

- Workflow logic, parsing, validation, and states MUST live in the Rust core, and TypeScript MUST
  reach them only through the binding, never reimplemented. Checked by review.
- The `ura` CLI MUST be Rust needing no runtime, the server TypeScript on Node, and the web UI React
  with Astryx, fed only by the server through fate. Checked by review.
- The web UI MUST draw workflow files from the core's document tree, never parsing their markdown.
  Checked by review.
- The server MUST accept only requests that Uraeda's own pages, or frames it gave a secret, make,
  and MUST listen only on the loopback interface. Checked by the guard's tests.
- The server MUST NOT let a preview's frame save, create, or open files, through Storybook or
  otherwise, and the web UI MUST sandbox previews apart from Uraeda's origin. Checked by the preview
  proxy's and the embed's tests.
- Editor plugins MUST reach workflow files only through `ura lsp`, over the core, and completions
  and code actions MUST edit only the open document: committing MUST be a command the user runs.
  Checked by review.
- The server MAY run a checkout's active [preview](preview.md) command, and MUST stop it when the
  server stops. Checked by the runner's tests.

## Why

The CLI is a small native binary while agent SDKs and fate are TypeScript, so a napi-rs binding
shares one core
([which language for each part](../done/2026-10-10-stack-decision.md#q1-which-language-for-each-component)).
A second parser would drift from the core's rules
([where the UI's structure comes from](../done/2026-10-11-web-ui.md#q4-where-does-the-structure-the-ui-draws-come-from)).
The server commits and runs project code, so only Uraeda's pages and secret-carrying frames reach it
([how previews prove they come from you](../done/2026-10-16-basic-security.md#q6-how-do-previews-and-mockups-prove-they-come-from-you)).
Storybook trusts whatever role its channel claims, and Uraeda cannot tell its interface from a
story's code, so writes stay off through Uraeda
([saving stories from Storybook](../done/2026-10-17-access-storybook.md#q2-can-you-save-stories-and-create-them-from-storybooks-interface)).
Approving must be deliberate, so commits stay out of code actions
([picking a human status](../done/2026-10-13-nvim-plugin.md#q2-what-does-picking-a-human-status-do)).

## Alternatives considered

- All TypeScript, the CLI shipped with Bun: one toolchain, but an 80 MB binary.
- All Rust: no official agent SDKs, and fate only through GraphQL.
- The server or an editor plugin calling `ura --json`: one process per call, and edits outside the
  editor's undo.
- A markdown parser in the UI or in Lua: a second parser.
- `tower-lsp-server`: five times larger, with tokio.

## Consequences

- One parser and one validator serve every tool: a new markdown feature or editor action starts in
  the core.
- Contributors and CI need Rust and Node, and fate stays pinned, since its custom sources use
  undocumented types.
- The server runs a preview command a human approved. A story can read any checkout's preview and
  mockup paths, but nothing else.
- Storybook's full interface works through Uraeda, its message origin checks turned off by the
  skill's `uraeda-preview.js`: a story can make it show another story, and nothing more. Saving or
  creating a story works only on Storybook's own port.
- Anyone signed in can allow a new host name, accepted from the next request.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
- [`editors/`](/editors/), and every feature that adds an editor integration
