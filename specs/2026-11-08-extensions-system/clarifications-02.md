---
status: answered
---

# Clarifications, round 02: Extensions system

> [!NOTE]
>
> Answered on 2026-11-08.
>
> - Verdict: worth building, with changes: the host, hot reload, and built-ins as extensions are
>   feasible now. Workflows as extensions would double the feature, so they come next.
> - Your orchestrator idea is the first question: what this feature builds, and what waits for
>   workflow definitions.
> - How deep built-ins go, and what hooks can do, work together: they decide what "a strong core"
>   means.
> - A new dependency: Uraeda compiles your extensions itself, with oxc, and the plan measures its
>   size.
> - The compatibility decision changes now that Uraeda is past 1.0.
> - A relaxed guard: a folder you link reloads at once, so whatever edits it, an agent session
>   included, changes code running as you.
> - Five points are settled without you under "Check these": hot reload, styling, and sharing.

## Context

### Since the last round

Your [answers to round 01](clarifications-01.md) set the trust model: your own extensions,
in-process, from your config folder, installed by `ura`. They also widened the feature: hooks on
every event, built-ins rebuilt as extensions, Uraeda building extensions itself, and hot reload.
Your notes muse about Uraeda as an orchestrator, with workflows as extensions. This round asks what
those mean in practice.

### Goal

Uraeda lets you, and the people you share it with, change any part of it from outside its source. No
build step or restart is needed. An opinionated default stays, and every part of it can be turned
off or replaced.

### Today

The workflow's two kinds, feature and change, are tables in the Rust core, copied in about thirty
TypeScript files. Built-ins like the inbox are drawn by literals in about fifteen web files. No
event says a step changed. Settings and themes already reload when their files change.

How tools with customizable workflows do it:

| Tool        | Workflow                    | Hooks                                  | Default             |
| ----------- | --------------------------- | -------------------------------------- | ------------------- |
| Spec Kit    | YAML steps, read by its CLI | Before and after each command, prompts | A bundled workflow  |
| OpenSpec    | A schema of artifacts       | None                                   | One built-in schema |
| Kiro        | Fixed spec types            | Triggers running a command or a prompt | Built in            |
| BMAD Method | Skills                      | Prose on completion                    | Its own modules     |

### Scope

This round settles what the feature builds of your notes, how deep built-ins go, hooks, how
extensions are compiled, and the compatibility decision. Round 01's answers stand.

### Sources

- The core's workflow tables, the web's places and keys, the server's events, and the web build,
  linked in the discovery.
- Spec Kit, OpenSpec, BMAD Method, superpowers, Kiro, Jira, GitHub Actions, pi, and Raycast.
- Node's module loader, Vite's module runner, oxc, esbuild, rolldown, jiti, StyleX, and import maps,
  with measurements on Node 24.
- The full investigation is in [discovery](discovery-02.md), and round 01's in
  [discovery](discovery-01.md).

## Check these

- **Hot reload** covers the server and the web UI. A changed extension unloads, undoing everything
  it registered, then loads again, in about 10 ms. A page it draws remounts and loses its unsaved
  state, since production React cannot refresh in place. See
  [reloading server modules](discovery-02.md#reloading-server-modules).
- **A runtime with a running session** reloads once the session's turn ends, so a reload never cuts
  an agent mid-turn.
- **Extensions style with Astryx's components and the theme's colours**, its CSS variables, not
  StyleX: StyleX at run time needs Babel, 1.5 MB. Extensions also skip React Compiler. See
  [styling extension pages](discovery-02.md#styling-extension-pages).
- **An extension imports only its own files and what Uraeda shares**: React, Astryx, and Uraeda's
  extension API. A library it needs is copied into its folder. This keeps "no npm install" true.
- **Sharing** stays a git URL that `ura extension add` installs, as round 01 chose: no catalog.

## Q1: What does this feature build of the orchestrator idea?

Example: you want a "research" workflow, with only a proposal, a discovery, and a summary, and a
"deploy" step after a feature merges.

Your notes picture Uraeda as an orchestrator: features and changes as workflow extensions, the inbox
and proposals as core extensions. In round 01, you put core extensions next, "with the express goal
being workflow customization". Spec Kit and OpenSpec define workflows as data an engine reads:
steps, files, gates, and templates. In Uraeda, the two kinds span about 150 files in three
languages. More in [discovery](discovery-02.md#workflows-as-extensions).

Why it matters: it decides whether this feature also reshapes the workflow engine, and how long it
takes.

- **A (recommended). This feature builds the extension host, and moves Uraeda's places onto it, so
  each can be turned off. Workflow definitions come in the next feature, built on this host.**
  - Example: the deploy step is a hook now (Q3); the research workflow waits for the next feature.
  - [pro] workflows land on a host already proven by the inbox, the git page, and runtimes.
  - [con] a new workflow needs the next feature.
  - Why recommended: it follows your round 01 answer, and building the host first shapes how
    workflows plug in.
- **B. This feature also turns features and changes into workflow definitions, which extensions can
  add or replace.**
  - Example: both arrive in this feature.
  - [pro] the orchestrator in one feature.
  - [con] about twice the work, and a workflow format designed before the host exists.

**Answer:** B: It's ok for this feature to be extremely big. I think it'll be better if both are
made at once: this way the code can be directly evaluated against its integration with the new
workflow extensions.

### Q1.B: How is a workflow defined?

Only if you picked B in Q1. The core must read a workflow to run `ura check` and `ura next`, and
agents must follow it unaided, as the constitution's "tools are optional" asks.

Why it matters: it decides who can write a workflow.

- **A (recommended). As data: a TOML step table, with a markdown reference and templates per step,
  read by the core and shipped as part of the skill.**
  - [pro] agents read the same files the core reads; no compiler.
  - [con] a step's logic is limited to what the table can say.
  - Why recommended: Spec Kit and OpenSpec do it, and it keeps workflows followable by hand.
- **B. As WASM code the core runs, with markdown references for agents.**
  - [pro] any step logic.
  - [con] 2 to 19 MB more per binary, and Rust for authors.

**Answer:** B: WASM is better: a workflow could have hooks, code, anything. And it's more portable.

Making it a TOML step table is too restrictive.

## Q2: How deep do Uraeda's own parts become extensions?

Example: you want to remove the inbox and keep only proposals.

The inbox is drawn by literals in about fifteen web files: the navigation, phone tabs, home, keys,
and New page. The core reads, watches, and checks `INBOX.md` whatever the UI shows, and `ura init`
writes it. Spec Kit took two months to move git out of its core. How hooks reach these parts is Q3.
More in [discovery](discovery-02.md#the-core-and-built-in-extensions).

Why it matters: it defines the "strong core", and how much code moves.

- **A (recommended). Uraeda's places become built-in extensions on the same API as yours. They are
  the inbox, proposals and priorities, decisions, the git page, previews, notifications, the usage
  window, and agent runtimes. Each can be turned off. The core still reads and checks every file.**
  - Example: with the inbox off, its place, keys, home pane, and New-page section disappear.
    `INBOX.md` stays, and `ura check` still checks it.
  - [pro] proves the API on real parts, and you can replace any of them.
  - [con] about fifteen web lists and the server's data views become registries.
  - Why recommended: it reaches "everything" in the UI while the core stays one engine.
- **B. A setting hides places; built-ins stay built-in code, and extensions only add.**
  - Example: the inbox is hidden; its code still loads.
  - [pro] a fraction of the work.
  - [con] a built-in cannot be replaced, only hidden.
- **C. Built-ins leave the core too: `ura`, `ura check`, and the skill learn each part from its
  extension.**
  - Example: with the inbox off, `ura init` writes no `INBOX.md`, and nothing checks it.
  - [pro] the inbox is gone everywhere.
  - [con] reaches the core's engine, which the first question moves to the next feature.

**Answer:** A

## Q3: What can a hook do?

Example: "After a feature's implementation, update the docs," and "Notify my phone when a spec waits
for review."

Spec Kit and Kiro hook named points before and after steps. A hook either runs code, or adds an
instruction the agent follows. No event says a step changed today: the core only reports that a
folder changed. A hook only the web UI applies is invisible to an agent running the workflow from
the CLI. More in [discovery](discovery-02.md#hooks).

Why it matters: instructions added to runs change what agents do, beyond what the skill says.

- **A (recommended). Hooks run code on named events, like a step reached or a turn done. An
  extension can also add instructions to a step's runs.**
  - Example: the docs instruction joins the final review's run; the phone notice is code on "spec
    waits for review".
  - [pro] covers both examples.
  - [con] an added instruction applies only to runs the web UI starts.
  - Why recommended: both examples need it, and the core gains one event, a step changed.
- **B. Hooks only run code on events; runs stay as the skill writes them.**
  - Example: the phone notice works; the docs update needs its own run.
  - [pro] agents always follow only the skill.
  - [con] the docs example takes a second agent run.
- **C. A, plus hooks that block or rewrite every action, like pi's tool hooks.**
  - Example: an extension refuses a commit without a docs change.
  - [pro] nothing is out of reach.
  - [con] every action in the server gains a hook point, and a broken extension can block work.

**Answer:** A

## Q4: What compiles your extensions?

Example: you write `deploy.tsx` in a folder and link it; it should run on save.

Node runs TypeScript, but not TSX. oxc transforms both in about 2 ms. It exists as a native npm
package, 4.5 MB per platform, or as a Rust crate that joins Uraeda's binding. jiti, pi's choice, is
pure JavaScript at 1.75 MB, but slower. The web UI's package weighs about 3.5 MB today. More in
[discovery](discovery-02.md#compiling-extensions).

Why it matters: it adds a dependency, and sets the package's size.

- **A (recommended). oxc, built into Uraeda's Rust binding.**
  - [pro] no new npm package; the fastest.
  - [con] its size in the binding is unmeasured; the plan measures it first.
  - Why recommended: it keeps one native package per platform, as the distribution decision asks.
- **B. oxc's npm package, beside the binding.**
  - [pro] known size, 4.5 MB per platform.
  - [con] a second native package per platform.
- **C. jiti, in pure JavaScript.**
  - [pro] no native code.
  - [con] slower, and it pulls Babel in.

**Answer:** A

## Q5: How does the compatibility decision change now that Uraeda is past 1.0?

Example: Uraeda 1.4 renames a frontmatter field in specs.

The [compatibility decision](/specs/decisions/compatibility.md) applies "until Uraeda reaches
version 1.0": no fallback reading, and agents rewrite old files. Uraeda tagged 1.0 on 1 November.
Your round 01 answer already chose one extension API version, with mismatched extensions turned off.
More in [discovery](discovery-02.md#compatibility-after-10).

Why it matters: other people's repositories now hold Uraeda's files.

- **A (recommended). Keep the rule, without "before 1.0": a format change reads only the new format,
  agents rewrite old files, and the changelog names each change. Add the extension API's version
  rule.**
  - Example: an agent meeting the old field rewrites it, as today.
  - [pro] no old code kept; it already works for agents.
  - [con] a repository is unreadable to the web UI until an agent rewrites its files.
  - Why recommended: agents rewrite files in seconds, and the rule has worked feature after feature.
- **B. Format changes only in a major release, each with a migration `ura` runs.**
  - Example: Uraeda 2.0 renames the field, and `ura upgrade` rewrites it.
  - [pro] no repository breaks on a minor release.
  - [con] migration code for every format change.

**Answer:** A

## Settled without the human

### Under the hood

- **The loader** evaluates extension modules as functions, as Vite's module runner does, not with
  Node's `import()`, which keeps every version in memory. See
  [reloading server modules](discovery-02.md#reloading-server-modules).
- **Shared modules** reach extension pages at stable URLs: Uraeda rewrites `react` and Astryx
  imports while compiling. No import map is needed, which Firefox rejects once the page started. See
  [sharing React](discovery-02.md#sharing-react-and-astryx-with-extension-pages).
- **Stale extension objects** refuse calls after a reload, as pi's do, so a forgotten timer fails
  loudly.

**Notes:**

- **Extensions style with Astryx's components and the theme's colours**: I'd rather have a bit
  bigger binary for better code and performance.
