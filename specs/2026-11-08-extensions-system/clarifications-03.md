---
status: answered
---

# Clarifications, round 03: Extensions system

> [!NOTE]
>
> Answered on 2026-11-08.
>
> - Verdict: worth building, with changes: WASM workflows and "Uraeda builds them" fit together only
>   if workflows are TypeScript run in a JavaScript engine inside WASM.
> - Where workflows load from meets the constitution: a project's workflow must reach every clone
>   and CI run. The recommended answer commits it in the repository, sandboxed.
> - A relaxed guard: a cloned repository's workflow runs on your machine, unable to touch files,
>   network, or processes. It can still use all the time and memory its limits allow.
> - `ura` grows from 7.7 MB to about 12 MB, and the CLI decision changes to say so.
> - Four points are settled without you under "Check these", StyleX in extension pages among them.

## Context

### Since the last round

You chose workflows as extensions in this feature, written as WASM: "a workflow could have hooks,
code, anything" ([round 02](clarifications-02.md)). You also asked that Uraeda build your extensions
itself. Rust compiled to WASM needs your own toolchain, and round 01 kept extensions out of
repositories. This round reconciles both.

### Goal

Workflows, features and changes included, become extensions that both `ura` and the web UI run, and
that you write without installing anything.

### Today

The two workflows are tables in [the core](/crates/core/src/steps.rs). `ura` weighs 7.7 MB. The
skill reaches agents through files installed in the repository
([install.rs](/crates/core/src/actions/install.rs)).

| Way to run workflow code             | You write    | Added to `ura` | One hook, per `ura` run |
| ------------------------------------ | ------------ | -------------- | ----------------------- |
| JavaScript engine inside WASM (Javy) | TypeScript   | ~4.4 MB        | 6.7 ms                  |
| Any language compiled to WASM (Zed)  | Rust, mostly | ~13.8 MB       | 126 ms without a cache  |
| JavaScript engine, natively          | TypeScript   | ~1.3 MB        | 3–5 ms                  |

### Scope

How workflow code is written, where a project's workflow loads from, and how features and changes
are built. Round 01 and 02's answers stand.

### Sources

- The core's steps, watcher, embedded skill, and installer, linked above.
- Wasmtime, wasmi, Javy, ComponentizeJS, Zed, Zellij, and Extism, with measurements on this machine.
- The full investigation is in [discovery](discovery-03.md).

## Check these

- **Extension pages use StyleX and React Compiler**, as your note asked. Uraeda compiles them with
  Babel: about 5 MB of JavaScript, in the web UI's package only. See
  [StyleX at run time](discovery-03.md#stylex-and-react-compiler-at-run-time).
- **`ura` grows by about 4.4 MB for workflows and 2.5 MB for compiling TypeScript**. The CLI
  decision's "as small as possible" gains this exception. See
  [measured sizes](discovery-03.md#measured-sizes-and-times).
- **A workflow returns data, never acts**: steps, problems, instructions for agents, and hook
  results. Commits, commands, and network calls are server extensions' work. This keeps a workflow
  safe to load from a repository.
- **A workflow ships its skill part**: a reference per step and templates, installed beside the
  Uraeda skill. Agents then follow it unaided, as the constitution asks.

## Q1: How do you write a workflow's code?

Example: a "research" workflow, with a proposal, a discovery, and a summary, whose step logic you or
your agent write in an afternoon.

Uraeda can embed a JavaScript engine compiled to WASM, and run your TypeScript inside it, as Shopify
does with Javy. Or you compile any language to WASM yourself, as Zed's authors do with Rust. Both
run in `ura` and in the web UI. More in [discovery](discovery-03.md#workflow-code).

Why it matters: it decides what an author installs, and how big `ura` gets.

- **A (recommended). TypeScript, run by a JavaScript engine inside WASM that Uraeda ships. Uraeda
  compiles it; you install nothing.**
  - [pro] the same language as server and UI extensions; sandboxed; 6.7 ms per hook.
  - [con] JavaScript only; about 4.4 MB more in `ura`.
  - Why recommended: it keeps both your choices, WASM and "Uraeda builds it".
- **B. Any language you compile to a WASM component yourself, Rust first.**
  - [pro] any language, and the fastest code once loaded.
  - [con] you install Rust and a WASM target; `ura` grows by about 13.8 MB.
- **C. TypeScript, run by a JavaScript engine built natively into `ura`, without WASM.**
  - [pro] the smallest, at 1.3 MB.
  - [con] the engine had sandbox-breaking flaws in 2026, which would reach `ura` itself.

**Answer:** B

## Q2: Where does a project's workflow load from?

Example: your repository uses the "research" workflow. A colleague clones it, and CI runs
`ura check` on it.

Round 01 loads extensions only from your config folder, since server extensions run with your
rights. A WASM workflow cannot touch files, network, or processes unless Uraeda lets it. The
constitution asks that workflow state be "recoverable from the repository alone". More in
[discovery](discovery-03.md#where-workflows-load-from).

Why it matters: it decides whether a repository's workflow follows it everywhere, and what a cloned
repository can run.

- **A (recommended). In the repository, under `specs/`, loaded sandboxed without asking. Server and
  UI extensions stay in your config folder.**
  - Example: the colleague's `ura check` and CI read the research workflow at once.
  - [pro] the constitution holds; nothing to install per clone.
  - [con] a cloned repository runs its workflow on your machine, within limits.
  - Why recommended: the sandbox makes it safe, and the workflow is the repository's own.
- **B. In your config folder, like other extensions; the repository names the workflows it needs.**
  - Example: the colleague installs the workflow before `ura check` reads the project.
  - [pro] one rule for every extension.
  - [con] a clone without it cannot read its own steps, against the constitution.

**Answer:** B

## Q3: How are features and changes built as workflows?

Example: you open the home page of a repository with 40 features.

The watcher recomputes each feature's step on every change. Native code does it in microseconds; the
WASM path takes about 2 ms per call. A workflow written on the WASM path proves the interface
directly. More in [discovery](discovery-03.md#built-in-workflows).

Why it matters: it trades speed against proof that the interface suffices.

- **A (recommended). Native Rust behind the same workflow interface, shipped as built-in extensions
  you can turn off or replace. A sample "research" workflow in TypeScript proves the WASM path.**
  - Example: the page stays as fast as today.
  - [pro] no cost on every change.
  - [con] the built-ins do not use the path your workflows use.
  - Why recommended: the performance decision gives a page 100 ms, and the sample covers the proof.
- **B. Rewritten in TypeScript, on the WASM path, like Zellij's built-in plugins.**
  - Example: about 80 ms more on that change, for 40 features.
  - [pro] the built-ins prove the path every day.
  - [con] slower, and the core's step logic is rewritten.

**Answer:** A

**Notes:** Sorry, I know this is messy...

But let's DROP workflows extensions from this feature. Put it in "later"

We'll continue being focused on the uraeda flow.

The extensions will ONLY be server-side, nothing in the repo.

And the extensions can touch:

- The server for data fetching or agent driving
- The client for a new UI

The example extensions are:

- Claude Code
- Codex (will add it when extensions are ready)
- A pi-durable based runtime
- A "deploy" tab that fetches and caches data from a remote, and shows it in the UI, with the same
  look and feel as the rest of the app. Accessible with the leader menu.
- A "wiki" tab that lets the user navigate the "docs" folder like a wiki (just an example)
