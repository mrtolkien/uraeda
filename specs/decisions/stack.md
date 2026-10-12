---
status: active
approved-by: mrtolkien
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
- The web UI MUST use React and Astryx components, live in [`packages/web`](/packages/web/), and get
  its data only from the server, through fate.
- The web UI MUST draw workflow files from the document tree the core sends, and MUST NOT parse
  markdown, with a library or by hand.
- The server MUST listen on 127.0.0.1 only. It MUST reject requests whose `Host` is not `127.0.0.1`
  or `localhost` on its port, or a host name listed in `URAEDA_ALLOWED_HOSTS`, and requests whose
  `Origin`, when present, is not the server's own, `https://` and a listed host name, or an allowed
  origin.

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
([Q4](../done/2026-10-11-web-ui.md#q4-where-does-the-structure-the-ui-draws-come-from)).

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

## Consequences

- One parser and one validator, in Rust, for the CLI, the server, and the UI.
- The CLI stays small, and the server uses the official Claude Code and Codex SDKs, fate, and
  pi-durable in process.
- Two toolchains: every contributor and CI need Rust and Node, and the binding must be built before
  the TypeScript tests run.
- Shipping the server means shipping a native addon per platform, or a container image.
- Every core type the TypeScript side uses must be expressible through napi-rs.
- fate's custom sources rely on types it exports without documenting them: a fate release can break
  them, so its versions stay pinned and upgrades are deliberate.
- Anyone who can reach a listed host name reaches the server: the tailnet's access rules are its
  only protection there.
- Every markdown feature the UI shows, like a new callout type, is added to the core first.

## Applies to

- [`crates/`](/crates/) and [`packages/`](/packages/), and every feature that adds logic, a command,
  an endpoint, or a page
