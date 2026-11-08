---
status: answered
---

# Clarifications, round 01: Extensions system

> [!NOTE]
>
> Answered on 2026-11-08.
>
> - Verdict: worth building, with changes: server and UI extensions build on seams the code already
>   has. Core extensions in WASM clash with the CLI decision, and add megabytes to both binaries.
> - Three choices last beyond this feature and become a new decision: what extensions are for, how
>   their code runs, and where they load from. They work together: answer them as one.
> - A relaxed guard: with the recommended answers, an extension acts as you, with your repositories,
>   your git, and your agent. Only you install one, and never from a cloned repository.
> - Two active decisions may change: the agents decision, for runtimes others write, and the
>   distribution decision, only if the web UI installs extensions.
> - The proposal's "references system" reads three ways: one question asks which you meant.
> - Unverified: whether a separately built extension page can share the app's React, its Astryx
>   components, and fate's data. The plan checks it first.
> - Six points are settled without you under "Check these": the manifest, settings, and dev loop.

## Context

### Goal

The [proposal](proposal.md) asks for Uraeda to take extensions, since an LLM writes one in minutes.
It names three kinds: core (WASM?), server (TypeScript?), and UI. The Claude integration and "the
references system" are candidates. It is one feature, for your own use first, as the
[priorities](../PRIORITIES.md) say.

### Today

Uraeda has no extension mechanism. Three seams come close:

- Agents are reached through one interface, the [`Adapter`](/packages/server/src/runner/adapter.ts).
  Claude Code is its only real implementation, [hard-wired](/packages/server/src/main.ts) at start.
- Colour themes are TOML files you drop in a folder beside the settings file, read by the
  [core](/crates/core/src/themes.rs).
- Keys go through one [registry](/packages/web/src/keys/registry.tsx), which components fill while
  mounted.

Everything else is fixed when Uraeda is built: check rules, steps, routes, pages, settings
categories, and `ura` commands.

How the products you named, and a few others, compare:

| Product          | Extension code                  | Isolation                 | Loads from                        |
| ---------------- | ------------------------------- | ------------------------- | --------------------------------- |
| VS Code          | JavaScript                      | Own process, full rights  | Marketplace; trust for a folder   |
| Zellij           | WASM, Rust                      | Sandbox, permissions      | A file or URL                     |
| Zed              | WASM for code, TOML for data    | Sandbox, porous by design | Its registry                      |
| pi               | TypeScript, no build            | None, full rights         | User folder; project after trust  |
| DeepSeek Harness | TypeScript, everything a plugin | None, full rights         | npm or git, after confirmation    |
| Claude Code      | Skills, hooks, mods (JS)        | None for plugin code      | Marketplaces; project after trust |

### Scope

Extensions of the server and the web UI, and whether the core takes any. A way to install, list,
enable, and disable them. The Claude Code runtime moved behind the extension API. A public catalog,
signing, and scans are left out.

### Sources

- The code, linked above and in the discovery: the runner, and the core's checks, steps, themes, and
  settings. Then the server's routes and fate setup, and the web's routes, keys, and settings.
- VS Code, Zellij, Zed, pi, DeepSeek Harness, Claude Code, opencode, Cursor, Obsidian, Grafana,
  Backstage, and Figma, from their official documentation.
- Wasmtime, WASI 0.3, Extism, jco, Node's type stripping and permission model, MCP Apps, and
  security write-ups on extension supply-chain attacks.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **The manifest** is an `extension.toml` at the extension's root, like Zed's: its name, version,
  the API version it needs, and what it contributes. TOML matches the settings and theme files. See
  [what they have in common](discovery-01.md#what-they-have-in-common).
- **Extensions ship ready to run**, with no install step: no `npm install`, no install scripts.
  Server code may be TypeScript, run by Node's built-in type stripping, so a local extension needs
  no build. UI code ships built, since browsers run no TypeScript. See
  [TypeScript in Node](discovery-01.md#typescript-in-node).
- **Enabling and settings** live in the settings file: an `[extensions]` table says which are on.
  Each extension's settings are a table of their own, shown on the settings page. A secret an
  extension needs comes from an environment variable, never the file, as the
  [settings decision](/specs/decisions/settings.md) asks.
- **A broken extension** is turned off alone, its problem shown on the settings page, as a broken
  theme is today. The server and the other extensions start without it.
- **Changes apply when the server restarts**, the page saying so. A `--extension <folder>` flag
  loads one folder for a run, like pi's `-e` and Claude Code's `--plugin-dir`, so an agent can try
  the extension it writes. See [pi](discovery-01.md#pi).
- **Only the agent runtimes move** behind the extension API in this feature. Themes stay a built-in
  folder, which extensions can also fill. The preview runner, notifications, and the usage window
  stay built in: none needs to be replaced yet. The workflow's pages are the product, not
  extensions. See
  [what could be an extension](discovery-01.md#what-existing-part-of-the-code-could-be-made-into-an-extension).

## Q1: What are extensions for, first?

Your proposal's reason is that an LLM writes an extension in minutes. Without extensions, your agent
can still patch Uraeda's source, but each patch conflicts with the next release. Extensions keep
those changes outside the source. A public ecosystem is another goal: other people's extensions,
found in a catalog. VS Code, Obsidian, and Claude Code show what that needs: review, signing,
malware scans, and an API that holds. More in [discovery](discovery-01.md#purpose).

Why it matters: this sets how much trust an extension needs, how stable its API must be, and how
much this feature builds. The isolation (Q4, Q5) and install questions (Q6, Q7) follow from it.

- **A (recommended). Extensions are yours: written by you or your agent, or copied from someone you
  trust, installed by hand. No catalog.**
  - [pro] matches "still wanted for my personal usage"; the API can change before 1.0.
  - [con] sharing one means sending its repository's address.
  - Why recommended: it is what the priorities ask for now, and a catalog can come on top later.
- **B. A public ecosystem from the start: a catalog of extensions others publish, and an API kept
  stable for them.**
  - [pro] others' work reaches you without asking them.
  - [con] a catalog, its review, and a stable API, months of work before any user exists.

**Answer:** A

## Q2: Should the Rust core take extensions in this feature?

Example: a project wants `ura check` to warn when a spec has no "Rollout" section.

The core holds the workflow's logic: steps, checks, and parsing. The
[CLI decision](/specs/decisions/cli.md) says every rule `ura` checks is written in the skill, so
agents follow it unaided, as the constitution's "tools are optional" asks. A core extension in WASM
would run in `ura` and in the server's binding. Wasmtime, the usual runtime, adds 2 to 19 MB to
each. Its authors need Rust and a WASM target. Zed and Zellij do this; agent harnesses do not. More
in [discovery](discovery-01.md#core-extensions).

Why it matters: it decides whether this feature builds a second extension host, in Rust, beside the
TypeScript one.

- **A (recommended). No core extensions in this feature. Server and UI extensions can read the
  workflow through the core, but not change its rules or steps.**
  - Example: the "Rollout" warning is a line in the project's constitution or a decision, which
    agents follow and review catches.
  - [pro] no WASM host, no size cost, and the CLI decision holds.
  - [con] `ura check` cannot learn a project's own rule.
  - Why recommended: no need for a core rule shows in the code or the priorities yet, and the cost
    is a second host.
- **B. Core extensions as WASM components, run by Wasmtime in both `ura` and the server.**
  - Example: a WASM extension adds the rule; `ura check` and the web UI both warn.
  - [pro] one extension checks the same rule everywhere, sandboxed.
  - [con] 2 to 19 MB more per binary, a Rust toolchain for authors, and a rule text to ship with
    each rule.
- **C. WASM extensions run by the server only, through Node, with no change to `ura`.**
  - Example: the web UI warns, `ura check` does not.
  - [pro] no size cost in `ura`.
  - [con] the CLI and the web UI disagree on a file's problems.

**Answer:** A: Ok but mark down WASM core extensions as a next goal, with the express goal being
workflow customization.

### Q2.B: What may a core extension add?

Only if you picked B in Q2. Steps today are a closed list in the [core](/crates/core/src/steps.rs),
copied in seven TypeScript files.

Why it matters: adding steps opens the step table that every tool and the skill share.

- **A (recommended). Check rules only, each shipped with the text agents read for it.**
  - [pro] the step table stays one table.
  - [con] a project cannot add a workflow step.
  - Why recommended: a rule is self-contained; a step touches every tool.
- **B. Check rules and new workflow steps, with their references and templates.**
  - [pro] a project can add a "security review" step.
  - [con] the step table, its seven copies, and the skill open up.

**Answer:**

## Q3: What can a server or UI extension add?

Example: you want a Codex runtime, a "Deploy" page showing a preview environment, and a status-line
item with its state.

Products converge on a fixed list of things an extension contributes, each drawn by the host. VS
Code has 38. pi registers tools, commands, shortcuts, and renderers. DeepSeek Harness goes further:
"everything is a plugin", its own features included. More in
[discovery](discovery-01.md#contributions).

Why it matters: each kind of contribution is a registry to build and keep. Kinds left out can be
added later, without changing existing extensions.

- **A (recommended). A fixed set: agent runtimes, settings, commands with keys, pages, side panels,
  status-line items, renderers of session items, server routes, themes, and agent skills.**
  - Example: all three parts of the example are one extension.
  - [pro] covers what users of the compared products expect.
  - [con] about ten registries, each with its tests.
  - Why recommended: it covers the example, and each kind follows a pattern the code already has.
- **B. Agent runtimes and commands only, the rest later.**
  - Example: the Codex runtime works; the page and status item wait.
  - [pro] a third of the work.
  - [con] no UI extensions, which the proposal asks for.
- **C. Hooks on every event, with Uraeda's own features rebuilt as extensions, like DeepSeek
  Harness.**
  - Example: all three, and an extension could also replace the inbox.
  - [pro] nothing is out of reach.
  - [con] a rewrite of the server and the web UI.

**Answer:** C: I’m just scared of the complexity but it’s the approach that appeals to me. Maybe a
user wants to remove the inbox and just use proposals. IMO it should be allowed if it’s not too
complex (at least removing it from the UI)

## Q4: How does an extension's page run in the web UI?

Example: the "Deploy" page from Q3.

Three ways exist. In-page code shares the app's React and Astryx, as Grafana and Backstage do: it
looks like the app, but it can do anything you can. A sandboxed frame, on its own origin, talks to
the app by messages, as VS Code's webviews do; Microsoft advises using them "sparingly". A manifest
alone, drawn by the app, runs no code. Grafana built an in-page sandbox and is removing it. More in
[discovery](discovery-01.md#ui-isolation).

Why it matters: it sets what an extension's page can do to you, and whether it looks like Uraeda. It
becomes part of the extensions decision.

- **A (recommended). In-page modules, sharing the app's React and Astryx, trusted like Uraeda's own
  code.**
  - Example: the Deploy page uses Astryx's lists and buttons, in your theme, at every width.
  - [pro] looks and behaves like the rest of the app, keyboard included.
  - [con] the page can do anything you can in Uraeda: commit, start agents, read every repository. A
    React or Astryx upgrade can break it.
  - Why recommended: the extension is yours (A in Q1), and an agent with a shell can already do more
    than it.
- **B. Sandboxed frames on a separate origin, talking to the app by messages.**
  - Example: the Deploy page draws its own buttons, coloured from the theme's variables.
  - [pro] the page can only send the messages the app accepts.
  - [con] it never quite looks like the app, and keys, focus, and sizing cross a frame.
- **C. No code: an extension declares pages as data, which the app draws with its own components.**
  - Example: the Deploy page is a list of fields a server route fills.
  - [pro] safe and consistent.
  - [con] only the layouts the app offers.

**Answer:** A

## Q5: How does an extension's server code run?

Example: the Codex runtime from Q3 spawns `codex`, and the Deploy page's route calls a hosting API.

Node offers no in-process sandbox: its own documentation says `vm` and the permission model do not
stop malicious code. A child process per extension, as Grafana does, contains crashes, not access.
pi, Claude Code, and DeepSeek Harness run extensions in-process. More in
[discovery](discovery-01.md#server-isolation).

Why it matters: it decides whether a broken extension can crash the server, and what an extension
can reach.

- **A (recommended). In the server's process, as ES modules, trusted like Uraeda's own code.**
  - [pro] the simplest API: functions and objects, no protocol.
  - [con] an extension can do anything the server can, as you, and a crash in it stops the server.
  - Why recommended: a process adds a protocol without adding a security boundary.
- **B. Each extension in a child process, talking to the server by messages.**
  - [pro] a crash stops only the extension.
  - [con] a message protocol for every contribution, and one more process per extension.

**Answer:** A

## Q6: Where may Uraeda load extensions from?

Example: you clone a colleague's repository, which holds an extension folder, and open it in Uraeda.

The [settings decision](/specs/decisions/settings.md) reads settings and themes only from your
config folder, so "no repository restyles the UI". VS Code, Claude Code, and pi load a project's
extensions only after you trust the project. In 2026, attacks on coding agents came from files a
repository or an agent wrote, which a trusted tool then ran. More in
[discovery](discovery-01.md#load-sources).

Why it matters: it decides whether opening a repository can run code. It becomes part of the
extensions decision.

- **A (recommended). Only from your config folder, beside the settings file. A repository never
  loads one.**
  - Example: the colleague's extension does nothing until you install it yourself.
  - [pro] opening a repository never runs code; the settings decision holds.
  - [con] a team cannot ship an extension inside its repository.
  - Why recommended: the extensions are yours (A in Q1), and it keeps one rule for themes, settings,
    and code.
- **B. Also from a folder in the repository, after you trust that repository once.**
  - Example: Uraeda asks "Trust this repository's extensions?" before loading it.
  - [pro] a team shares its extensions with its code.
  - [con] one yes lets the repository's authors run code as you, and later commits change that code.

**Answer:** A

## Q7: How is an extension installed?

Example: you want an extension from a git repository.

The [distribution decision](/specs/decisions/distribution.md) says the web UI's package downloads
nothing when it runs. `ura` is installed apart, so it may fetch. Claude Code pins community plugins
to a commit and turns their updates off. More in [discovery](discovery-01.md#installing).

Why it matters: it decides who fetches extension code, and whether an update can change code you
reviewed.

- **A (recommended). `ura extension add <folder or git URL>` copies or clones it into the config
  folder, pinned to its commit. `ura extension update` moves it, showing what changed. The web UI
  lists, enables, and disables them.**
  - [pro] the distribution decision holds; nothing updates without you.
  - [con] installing needs a terminal.
  - Why recommended: it keeps reviewed code fixed, and an agent can run the same command.
- **B. By hand only: you copy or clone the folder yourself. The web UI lists, enables, and disables
  them.**
  - [pro] nothing to build for installing.
  - [con] no pinning or update helper.
- **C. From the web UI too: paste a git URL, and the server fetches it.**
  - [pro] no terminal needed.
  - [con] changes the distribution decision; the server then runs `git` on any URL it is given.

**Answer:** A

## Q8: How does the Claude Code runtime become an extension?

Claude Code is reached through the `Adapter` interface today, but Claude's habits leak outside it.
The runner checks that Claude loaded the `uraeda` plugin, and the web shows Claude's five-hour usage
window. Codex and pi runtimes are in the priorities. More in
[discovery](discovery-01.md#agent-runtimes).

Why it matters: the first real user of the runtime API decides whether it fits a second runtime.

- **A (recommended). Claude Code becomes a built-in extension, shipped with Uraeda, on the same API
  as others. Its habits move inside it.**
  - [pro] the API is proven by a real runtime; nothing changes for you.
  - [con] the built-in extension cannot be removed, only turned off.
  - Why recommended: it proves the API without an install step for anyone.
- **B. Claude Code becomes a separate extension, installed apart from Uraeda.**
  - [pro] Uraeda itself names no agent.
  - [con] every user installs it before their first session.
- **C. Runtimes stay built in, not open to extensions.**
  - [pro] no API to keep for runtimes.
  - [con] Codex and pi need changes to Uraeda's source.

**Answer:** A

### Q8.A: Must a runtime from an extension follow the agents decision?

Only if you picked A in Q8. The [agents decision](/specs/decisions/agents.md) says the server runs
"the user's installed agent, never a bundled one or the agent's SDK". It exists for Anthropic's
subscription terms. A pi runtime written by you might embed pi's SDK.

Why it matters: it decides whether the decision binds code Uraeda does not ship.

- **A (recommended). The rule binds Uraeda's shipped runtimes only. An extension's runtime is your
  choice, and the decision says so.**
  - [pro] a pi or Codex extension uses what fits its agent.
  - [con] a runtime extension can break its agent's terms, without Uraeda knowing.
  - Why recommended: the extension is yours, and the terms are yours to keep.
- **B. The rule binds every runtime, shipped or not.**
  - [pro] the decision stays as it is.
  - [con] an SDK-only agent cannot become a runtime.

**Answer:** A

### Q8.B: Must a runtime from an extension follow the agents decision?

Only if you picked B in Q8. The same rule as above: the server runs "the user's installed agent,
never a bundled one or the agent's SDK". With Claude Code itself an extension, Uraeda ships no
runtime.

Why it matters: without a change, the rule binds nothing Uraeda ships.

- **A (recommended). The rule binds the Claude Code extension, which Uraeda's author keeps. Others'
  runtimes are your choice.**
  - [pro] the terms stay kept for Claude Code.
  - [con] the rule names one extension.
  - Why recommended: it keeps the rule's reason where it applies.
- **B. The rule binds every runtime extension.**
  - [pro] one rule for all.
  - [con] an SDK-only agent cannot become a runtime.

**Answer:**

## Q9: What did you mean by "the references system, which is more of a skill"?

The phrase reads three ways. Extensions could ship agent skills, which Uraeda passes to the agent
with its own, as pi and Claude Code packages do. Extensions could add or replace the workflow's own
steps, the skill's `references/`. Or the "References (docs) querying" item of the priorities could
be built as an extension. More in [discovery](discovery-01.md#skills).

Why it matters: the second reading opens the core's step table, which the recommended answer to Q2
leaves closed.

C can come on top of A.

- **A (recommended). Extensions can ship agent skills, which Uraeda passes to the agent with its own
  skill. The workflow's steps stay the skill's.**
  - [pro] uses the Agent Skills format every harness reads.
  - [con] an extension cannot change how a step runs.
  - Why recommended: it gives agents new knowledge without opening the workflow.
- **B. Extensions can also add or replace workflow steps, with their references and templates.**
  - [pro] a project can add its own step.
  - [con] opens the core's steps and checks, as core extensions would.
- **C. The "References (docs) querying" priority becomes the first extension, built after this
  feature.**
  - [pro] a real extension tests the API early.
  - [con] that feature waits for this one.

**Answer:** A

## Q10: What happens to extensions when their API changes before 1.0?

Example: Uraeda 1.4 renames a field every runtime extension reads.

The [compatibility decision](/specs/decisions/compatibility.md) forbids keeping old formats working
before 1.0. VS Code and Obsidian have extensions state the host versions they support. Zed keeps
every old API version working forever. More in [discovery](discovery-01.md#api-versions).

Why it matters: it decides what an upgrade does to your extensions.

- **A (recommended). The API has one version number. An extension states the one it needs, and a
  mismatched one is turned off, with a message naming the change.**
  - Example: after the upgrade, your runtime extension is off, and its settings page says why.
  - [pro] no old code kept; the compatibility decision holds.
  - [con] every API change means updating your extensions; your agent does it.
  - Why recommended: your extensions are few and yours, and an agent updates them in minutes.
- **B. Old API versions keep working, like Zed.**
  - Example: the extension works unchanged.
  - [pro] upgrades never turn an extension off.
  - [con] old API code grows with each version, against the compatibility decision.

**Answer:** A: We’re already past 1.0 btw, change the decision

## Settled without the human

### Behaviour

- **A runtime's session** keeps the runtime it started with. When that runtime is off or removed,
  the session shows why, and can be read but not continued. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **A key two extensions claim** goes to the first loaded; the second one's command shows the
  conflict on the settings page. The keyboard decision's rule of one meaning per key holds. See
  [the proposal's path](discovery-01.md#the-proposals-path-and-existing-actions).
- **Writing an extension** gets a page in `docs/` and an example extension, so an agent has
  something to follow. See [documentation](/specs/decisions/documentation.md).

### Under the hood

- **Claude's habits** move inside its adapter: the plugin check, the system prompt's text, tool
  input keys, and the usage window's shape become the adapter's. See
  [important reads](discovery-01.md#important-reads).
- **The sandbox** loads only extensions from its sample projects' config, never yours, as the
  [sandbox decision](/specs/decisions/sandbox.md) asks.
- **Server routes** an extension adds sit under its own path, behind the same sign-in as every
  route, and join the sign-in route table test. See [sign-in](/specs/decisions/sign-in.md).
- **Tests** reach runtimes through the fake adapter, itself loaded as an extension, as the agents
  decision asks.

**Notes:** I know it’s hard: I want to combine an opinionated workflow and UI with easy
extensibility.

I myself am not sure how deep the extensibility really should be.

Maybe uraeda could be more of an orchestrator and the default workflow be an extension itself?
Because then we’d be able to define workflows: change and features would become workflow extensions,
and inbox and proposals core extensions. We could even have a docs or deploy extension. And hooks
inside the workflows (for example triggering documentation update).

I know it’s a bit fuzzy. It is fuzzy for me too.

I’m happy with the current state of uraeda for my personal use btw. This feature is more to be able
to share and let it be used by other people. I’m doing it now because the core features are good and
I want to explore extensions because the codebase becomes too big and monolithic that it’s
impossible to add an extension system.

We can do more clarifications and more research as needed. No need to rush to a spec.

- **Extensions ship ready to run**: It’s extremely crucial that creating local extensions is
  trivial. Build should be simple/handled by us directly.
- **Changes apply when the server restarts**: No, we need hot reloading where possible. Requiring a
  server restart is a bad design pattern since most extensions will be created ad-hoc by users.
- **Only the agent runtimes move**: Honestly the more we can make into extensions (with a strong
  core) the more extensible/customizable it’ll be
