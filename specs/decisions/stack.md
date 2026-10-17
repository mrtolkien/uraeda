---
status: proposed
approved-by:
icon: layers
---

# Stack

Uraeda's workflow logic is written once, in Rust, in one core. The CLI reaches it directly, the
server and web UI through a Node binding, and editors through a language server. The server commits
and runs project code, so it stays local. It refuses every page but Uraeda's own and the frames it
gave a secret.

## Rules

- Workflow logic, parsing, validation, and states MUST live in the Rust core, and TypeScript MUST
  reach them only through the binding, with the types napi-rs generates, never reimplemented.
  Checked by review.
- The `ura` CLI MUST be Rust needing no runtime, the server TypeScript on Node, and the web UI React
  with Astryx, fed only by the server through fate. Checked by review.
- The web UI MUST draw workflow files from the core's document tree, never parsing their markdown;
  only an agent's messages MAY use Astryx's `Markdown`. Checked by review.
- The server MUST listen on 127.0.0.1 only, and reject a `Host` other than `127.0.0.1` or
  `localhost` on its port, or a host name its flag, variable, or settings file allows, in the
  [settings](settings.md) order, reread on each request. Checked by the guard's tests.
- The server MUST reject a present `Origin` other than its own, `https://` on an allowed host name,
  or an allowed origin; only GET, HEAD, and WebSocket upgrades on preview and mockup paths with the
  current [frame secret](sign-in.md) MAY send `Origin: null`. Checked by the guard's tests.
- The server MAY run a checkout's active [preview](preview.md) command in that checkout, on
  127.0.0.1 and a free port, and MUST stop it when the server stops. Checked by the runner's tests.
- The server MUST forward only that process's GET, HEAD, and WebSocket upgrades, on its preview
  path, with `Access-Control-Allow-Origin: *` and
  `Content-Security-Policy: sandbox allow-scripts allow-popups` on every response. It MUST forward
  Storybook's channel only as a preview's, whatever role the upgrade asks, so no frame saves,
  creates, or opens files through Storybook. Checked by the preview proxy's tests.
- The web UI MUST show a preview only in frames sandboxed without `allow-same-origin`, accept
  messages only from them, and give them only the story, its colour mode, and pick mode. Checked by
  the embed's tests.
- Editor plugins, in `editors/`, MUST reach workflow files only through `ura lsp`, and `ura lsp`
  only through the core, over stdio, on `lsp-server` without an async runtime. Checked by review.
- Completions and code actions MUST edit only the open document: writing another file or committing
  MUST be a command the user runs. Checked by review.

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
