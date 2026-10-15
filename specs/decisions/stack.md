---
status: active
approved-by: mrtolkien
---

# Stack

Uraeda's workflow logic is written once, in Rust, in a core crate. The `ura` CLI is a Rust binary
built on it. The server is a TypeScript program on Node that calls the same core through a napi-rs
binding, and the web UI is React with Astryx and fate, fed by the server. TypeScript never
reimplements what the core does, and the types that cross from Rust are generated, never written by
hand. Editors reach the same core through a language server, `ura lsp`, and their plugins never
parse workflow files.

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
- The web UI MUST use React and Astryx components, live in [`packages/web`](/packages/web/), and get
  its data only from the server, through fate.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand. It MAY render an agent's messages, which are not
  workflow files, with Astryx's `Markdown` component.
- The server MUST listen on 127.0.0.1 only. It MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or a host name listed in `URAEDA_ALLOWED_HOSTS`, and requests whose
  `Origin`, when present, is not the server's own, `https://` and a listed host name, or an allowed
  origin.
- The language server MUST live in `crates/lsp`, run as `ura lsp` over stdio, and reach workflow
  files only through the core.
- The language server MUST be built on the `lsp-server` and `lsp-types` crates, without an async
  runtime.
- Editor plugins MUST live in `editors/<editor>/`, and MUST reach workflow files only through
  `ura lsp`. They MUST NOT parse workflow files, their frontmatter, or their structure, with a
  library or by hand.
- The language server's completions and code actions MUST only edit the open document. Actions that
  write another file or commit MUST be commands the user runs explicitly, never code actions.

## Why

The CLI must install without a package manager, as a small native binary, and the human prefers
Rust's enums and cargo workspaces for workflow states. The server drives agents whose official SDKs,
and pi-durable, are TypeScript, and fate assumes a TypeScript server. A napi-rs binding lets both
share one core without a second parser
([Q1](../done/2026-10-10-stack-decision.md#q1-which-language-for-each-component),
[Q2](../done/2026-10-10-stack-decision.md#q2-how-do-the-backend-and-the-ui-reach-users),
[Q3](../done/2026-10-10-stack-decision.md#q3-where-are-workflow-files-parsed-and-validated),
[language split](../done/2026-10-10-stack-decision.md#q1-which-language-for-each-component)). The
server will commit to git and start agents, so a web page the user visits must not reach it
([local server security](../done/2026-10-10-stack-decision.md)).

fate is preferred over a plain JSON client because the web UI will hold live, graph-like data:
sub-agents and their runs, streamed responses, and drafts of answers edited in the browser. fate's
normalized cache, live views, and optimistic updates are built for that; with TanStack Query, each
of them is written by hand. fate reads data that is not in a database through sources built with the
types it exports, so it stays the data layer
([Q5](../done/2026-10-11-web-ui.md#q5-does-fate-stay-the-data-layer)).

The server listens on 127.0.0.1 only, but accepts the host names listed in `URAEDA_ALLOWED_HOSTS`,
so a phone reaches it through `tailscale serve`, which keeps it on 127.0.0.1 and passes the
machine's `*.ts.net` name
([Q2](../done/2026-10-11-web-ui.md#q2-how-does-your-iphone-reach-the-server)). The web UI draws the
core's document tree, since a second markdown parser in TypeScript would disagree with the core on
callouts, typed bullets, and source lines
([Q4](../done/2026-10-11-web-ui.md#q4-where-does-the-structure-the-ui-draws-come-from)). An agent's
messages are not workflow files, and look much better rendered: the human allowed Astryx's
`Markdown` component for them when approving the
[Claude Code runner](../done/2026-10-12-claude-code-runner-triggered-manually-https-code.md).

Editors reach the workflow through a language server, which the human chose over a plugin calling
the CLI, or parsing in Lua, so the editor gets diagnostics while typing and edits it can undo, and
other editors can use the same server
([Q1](../done/2026-10-13-nvim-plugin.md#q1-how-does-the-plugin-reach-the-workflow-logic),
[reaching the workflow logic](../done/2026-10-13-nvim-plugin.md#q1-how-does-the-plugin-reach-the-workflow-logic)).
`lsp-server` is the smallest server crate, synchronous like the core, and the one rust-analyzer
uses; `tower-lsp-server` costs about five times more in the binary, with tokio
([Rust language server crates](../done/2026-10-13-nvim-plugin.md)). A plugin parsing workflow files
would be a second parser, drifting from the core's rules, as a TypeScript one would. Commits stay
out of code actions: a code action is a quick fix, picked from a list next to other servers' fixes,
and approving or starting a feature must be a deliberate act
([Q2](../done/2026-10-13-nvim-plugin.md#q2-what-does-picking-a-human-status-do)).

## Alternatives considered

- All TypeScript, the CLI shipped with Bun: one toolchain, but an 80 MB binary.
- Rust for the core, the CLI, and the server: one 2.7 MB binary, but no official agent SDKs, and
  fate only through GraphQL.
- A TypeScript server calling the CLI with `--json`: no binding, but the server reaches the logic
  only through the CLI's output, one process per call.
- JSON routes read by Hono's typed client and TanStack Query, the fallback if fate could not read
  data outside a database: dropped once fate's sources did
  ([data layer](../done/2026-10-11-web-ui.md#q5-does-fate-stay-the-data-layer)).
- Astryx's `Markdown` component, or a TypeScript parser, for the UI's rendering: dropped for the
  core's document tree, the only parser that knows the skill's markdown and its source lines.
- An editor plugin calling `ura` with `--json` for every read and write: the smallest Rust work, but
  every write on disk, outside the editor's undo, and no diagnostics while typing.
- A plugin parsing workflow files in Lua: the most responsive, but a second parser.

## Consequences

- One parser and one validator, in Rust, for the CLI, the server, and the UI.
- The CLI stays small. The server runs agents through their installed command-line tools, as the
  [agents](agents.md) decision says, and uses fate and pi-durable in process.
- Two toolchains: every contributor and CI need Rust and Node, and the binding must be built before
  the TypeScript tests run.
- Shipping the server means shipping a native addon per platform, or a container image.
- Every core type the TypeScript side uses must be expressible through napi-rs.
- fate's custom sources rely on types it exports without documenting them: a fate release can break
  them, so its versions stay pinned and upgrades are deliberate.
- Anyone who can reach a listed host name reaches the server: the tailnet's access rules are its
  only protection there.
- Every markdown feature the UI shows, like a new callout type, is added to the core first.
- Neovim, Helix, VS Code, and Zed reach the same diagnostics, completions, and commands through one
  server; each editor still needs a thin plugin for pickers and input windows.
- The `ura` binary grows by the server and its two crates, about 263 KB measured alone.
- Every editor action is a core function first: an action the web UI lacks is added to the core, and
  both reach it.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
- [`editors/`](/editors/), and every feature that adds an editor integration

## Proposed change (2026-10-15-ui-iteration)

Proposed by the [spec](../2026-10-15-ui-iteration/spec.md). The server may run a project's
Storybook, from its active preview decision, in a checkout, and forward it under its own address, so
stories work wherever Uraeda is reached. The `Origin` rule is laxer on those paths only: it accepts
the sandboxed frames' `Origin: null` for reads and live connections.

The rules become:

- Workflow logic, parsing, validation, and workflow states MUST live in the Rust core,
  [`crates/core`](/crates/core/). Checked by review.
- The CLI MUST be written in Rust, in [`crates/cli`](/crates/cli/), build the binary `ura`, and MUST
  NOT need Node or any other runtime to run. Checked by review.
- The server MUST be written in TypeScript, run on Node, and live in
  [`packages/server`](/packages/server/). Checked by review.
- TypeScript code MUST reach the core only through the binding,
  [`packages/binding`](/packages/binding/), and MUST NOT reimplement its parsing, validation, or
  states. Checked by review.
- The TypeScript types of core data MUST come from the declarations napi-rs generates for the
  binding. They MUST NOT be redeclared by hand in TypeScript. Checked by review.
- The web UI MUST use React and Astryx components, live in [`packages/web`](/packages/web/), and get
  its data only from the server, through fate. Checked by review.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  their markdown, with a library or by hand. It MAY render an agent's messages, which are not
  workflow files, with Astryx's `Markdown` component. Checked by review.
- The server MUST listen on 127.0.0.1 only. It MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or a host name listed in `URAEDA_ALLOWED_HOSTS`. It MUST reject
  requests whose `Origin`, when present, is not the server's own, `https://` and a listed host name,
  or an allowed origin, except GET and HEAD requests and WebSocket upgrades under
  `/r/<repository>/preview/`, which MAY carry `Origin: null`. Checked by the guard's tests.
- The server MAY start the command of a project's active [preview](preview.md) decision, read from a
  checkout, in that checkout, bound to 127.0.0.1 on a free port. It MUST forward only that process's
  GET and HEAD requests and WebSocket upgrades, under `/r/<repository>/preview/<folder>/`, with
  `Access-Control-Allow-Origin: *` and a `Content-Security-Policy` of
  `sandbox allow-scripts allow-popups` on every response. It MUST stop the process when the server
  stops. Checked by the preview proxy's and runner's tests.
- The web UI MAY show a preview's pages only in frames sandboxed without `allow-same-origin`. It
  MUST accept messages only from those frames' windows, and MUST NOT give a frame any data beyond
  the story to show, its colour mode, and whether pick mode is on. Checked by the embed's tests.
- The language server MUST live in `crates/lsp`, run as `ura lsp` over stdio, and reach workflow
  files only through the core. Checked by review.
- The language server MUST be built on the `lsp-server` and `lsp-types` crates, without an async
  runtime. Checked by review.
- Editor plugins MUST live in `editors/<editor>/`, and MUST reach workflow files only through
  `ura lsp`. They MUST NOT parse workflow files, their frontmatter, or their structure, with a
  library or by hand. Checked by review.
- The language server's completions and code actions MUST only edit the open document. Actions that
  write another file or commit MUST be commands the user runs explicitly, never code actions.
  Checked by review.

Why: you chose live mockups run by Uraeda, from the project's own Storybook
([Q5](../2026-10-15-ui-iteration/clarifications-01.md#q5-how-do-you-see-interactions-not-only-a-still),
[round 02](../2026-10-15-ui-iteration/clarifications-02.md)), and they must work remotely through
Tailscale, with a laxer `Origin` rule allowed (C2 of the
[spec's review](../2026-10-15-ui-iteration/spec-review.md)). Products that run generated or project
UI next to a host give it no origin of its own, or another one
([running untrusted UI](../2026-10-15-ui-iteration/discovery-02.md#running-untrusted-ui-next-to-a-host)).
A frame sandboxed without `allow-same-origin` sends `Origin: null`, which every write and every
other route still refuses.

New consequences:

- The server runs project code, the preview command a human approved in the project's decision, and
  forwards its traffic.
- Anyone who reaches the server reaches the previews it runs, as for the rest of the server, until
  the basic security planned in Next.
- A story's code can read any path under `/r/<repository>/preview/`, of any checkout, but nothing
  else of the server.
