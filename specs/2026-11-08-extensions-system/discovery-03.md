# Discovery, round 03: Extensions system

## Why this round

The answers to [round 02](clarifications-02.md) put workflow definitions in this feature, as WASM
code: "a workflow could have hooks, code, anything. And it's more portable". Three unknowns came
with them:

- Round 02 also asked that Uraeda build local extensions itself, from TypeScript. Compiling Rust to
  WASM needs the author's own Rust toolchain.
- [Round 01](clarifications-01.md) loads extensions only from the config folder, never from a
  repository. A project's workflow must reach every clone and every CI run: the constitution asks
  that workflow state be "recoverable from the repository alone".
- Features and changes become workflow extensions. Whether they run as WASM or stay native code
  behind the same interface decides the speed of every step computed.

The notes also accept a bigger package for StyleX and React Compiler in extension pages.

## Summary

Two ways reconcile WASM with "Uraeda builds it". Uraeda can embed a JavaScript engine compiled to
WASM, QuickJS as Javy packages it, and run the author's TypeScript inside: the author needs no
toolchain, and the sandbox is WASM. Or authors compile any language to WASM components themselves,
as Zed's do with Rust, and `ura` carries a WASM compiler, Cranelift, 14 MB. Measured, the first runs
a hook in about 7 ms per `ura` call and adds about 4.4 MB to `ura`.

A WASM module with no file, network, or process access can only call what its host gives it. Zed,
Zellij, and Extism load untrusted modules on that model, with memory and time limits. That makes a
workflow committed in a repository far safer than the server extensions round 01 kept out of
repositories.

## How other products do it

### Running untrusted WASM

- Wasmtime: guests reach the outside only through the imports the host links; it fuzzes and
  backports security fixes, and "WebAssembly runtimes also run untrusted code from untrusted
  sources" ([security](https://docs.wasmtime.dev/security.html),
  [Wasmtime correctness](https://fitzgen.com/2022/09/13/security-and-correctness-in-wasmtime.html)).
- Time and memory limits: fuel is deterministic, epochs cost about 10%, and a resource limiter caps
  memory ([interrupting](https://docs.wasmtime.dev/examples-interrupting-wasm.html),
  [Config](https://docs.rs/wasmtime/latest/wasmtime/struct.Config.html)).
- Zed grants each extension named capabilities, and calls without a grant fail
  ([capabilities](https://zed.dev/docs/extensions/capabilities)).
- Extism's manifest: no hosts and no paths unless listed
  ([manifest](https://extism.org/docs/concepts/manifest)).
- A precompiled `.cwasm` file is native code: "Arbitrary data loaded from a file may trick Wasmtime
  into arbitrary code execution"
  ([Module](https://docs.rs/wasmtime/latest/wasmtime/struct.Module.html)). Only Uraeda's own release
  may ship one.

### JavaScript as WASM

- Javy runs JavaScript in QuickJS compiled to WASM. A shared engine module, 1.3 MB, runs each
  script's bytecode; Shopify runs it in production
  ([Javy](https://github.com/bytecodealliance/javy),
  [Shopify](https://shopify.engineering/javascript-in-webassembly-for-shopify-functions)). Its 9.0
  release changed the bytecode format.
- ComponentizeJS embeds an 8 MB engine per component, and calls itself experimental
  ([ComponentizeJS](https://github.com/bytecodealliance/ComponentizeJS)). `componentize-qjs`,
  released the day before this round, is too young to rely on.
- Zellij left Wasmtime for wasmi, an interpreter: compile times fell from "seconds" to milliseconds,
  with a "minor hit for compute-heavy operations"
  ([PR 4449](https://github.com/zellij-org/zellij/pull/4449)).

### Authoring in Rust

- Zed's extensions need rustup and the `wasm32-wasip2` target on the author's machine; published
  ones are compiled by Zed's CI
  ([developing](https://zed.dev/docs/extensions/developing-extensions)). No host compiles Rust
  without the author's toolchain.

### What they have in common

- A WASM module reaches only what its host links, with memory and time limits set by the host.
- Authors who write in a compiled language bring their toolchain; hosts that promise no toolchain
  embed an engine, as Shopify does with Javy.
- Precompiled native code comes only from the host's own release.

## Standards and libraries

### Measured sizes and times

Measured on x86_64 Linux, in a throwaway folder; `ura`'s release binary is 7.7 MB today.

| Option                                             | Added to `ura`   | One hook, whole `ura` process |
| -------------------------------------------------- | ---------------- | ----------------------------- |
| Wasmtime without compiler, Javy engine precompiled | 0.74 MB + 3.7 MB | 6.7 ms                        |
| wasmi, the Javy engine interpreted                 | 1.9 MB + 1.3 MB  | 40 ms                         |
| Wasmtime with Cranelift, any WASM component        | 13.8 MB          | 126 ms without a cache        |
| QuickJS embedded natively, no WASM                 | 1.3 MB           | 3–5 ms                        |
| oxc, to strip TypeScript in `ura`                  | 2.5 MB           | —                             |

- QuickJS-ng had memory-safety flaws in 2026, one "breaks the sandbox boundary" (seen in
  vulnerability databases' summaries). Inside WASM, such a flaw stays in the module's memory;
  native, it reaches `ura`.

### StyleX and React Compiler at run time

- Both are Babel plugins. StyleX's compiler with Babel is 1.5 MB minified; React Compiler's plugin
  3.9 MB ([discovery 02](discovery-02.md#styling-extension-pages)). Both are pure JavaScript, in the
  server's package only.

## The code

### Important reads

- [`steps.rs`](/crates/core/src/steps.rs) computes a feature's step from its files, in microseconds;
  the watcher recomputes every feature's step on each change
  ([watch.rs](/crates/core/src/watch.rs)). The
  [performance decision](/specs/decisions/performance.md) gives a page 100 ms.
- [`embedded.rs`](/crates/core/src/embedded.rs) embeds the skill: a workflow's references and
  templates would be embedded or read the same way.
- [`actions/install.rs`](/crates/core/src/actions/install.rs) installs the skill in a repository: a
  repository's workflow skill parts would join it.

### The proposal's path and existing actions

- **Cloning a repository with a custom workflow**: with the workflow in the repository, `ura check`
  works at once; with it in the config folder, `ura` cannot read the project's steps until it is
  installed.
- **CI running `ura check`**: the same.
- **An agent with no Uraeda tools**: reads the workflow's skill parts in the repository, as it reads
  the Uraeda skill today.

### Likely changes

- Under every option: a WASM host in [`crates/core`](/crates/core/), embedded in `ura` and the
  binding; the workflow interface; the step table read from workflows.
- With TypeScript workflows: the Javy engine, precompiled per platform in the release.
- With workflows in repositories: a folder under `specs/`, read by the core and checked by
  `ura check`.

## The proposal

### WASM and "Uraeda builds it"

Round 02 chose WASM for workflows, and asked that Uraeda build local extensions. Only a JavaScript
engine inside WASM gives both.

### Workflows and repositories

A workflow decides how a repository's files are read. Round 01 kept extension code out of
repositories, for server extensions, which run with your rights. A sandboxed workflow does not.

## Worth it and feasibility

- Checked: Javy's engine runs TypeScript stripped by oxc, compiled and run inside Wasmtime without a
  compiler, in 6.7 ms per process; fuel stops an endless loop.
- Unverified: the workflow interface's speed when the watcher recomputes many features.
- Guard: a repository's workflow can use as much time and memory as the limits allow, and write only
  what Uraeda lets a workflow write.

## Approaches

### Workflow code

| Option                                  | Author needs | Added to `ura` | Sandboxed |
| --------------------------------------- | ------------ | -------------- | --------- |
| A. TypeScript in QuickJS inside WASM    | Nothing      | ~4.4 MB        | Yes       |
| B. Any language, compiled by the author | A toolchain  | ~13.8 MB       | Yes       |
| C. TypeScript in QuickJS, natively      | Nothing      | ~1.3 MB        | API only  |

### Where workflows load from

| Option                                       | Clone and CI  | Constitution III |
| -------------------------------------------- | ------------- | ---------------- |
| A. Committed in the repository, sandboxed    | Work at once  | Holds            |
| B. Config folder, the repository naming them | Install first | Strained         |

### Built-in workflows

| Option                                       | Speed       | Proves the interface         |
| -------------------------------------------- | ----------- | ---------------------------- |
| A. Native Rust behind the workflow interface | As today    | Through a sample TS workflow |
| B. TypeScript on the WASM path               | ms per call | Directly                     |

### Needs no choice

- **StyleX and React Compiler in extension pages**: the notes accept the size; Babel ships in the
  server's package only.

## Not checked

- `componentize-qjs`'s output size: its binary could not run here.
- Pulley's speed: secondhand only.
