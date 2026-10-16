# Uraeda

Uraeda is a git-driven, asynchronous development workflow for coding agents. Humans write proposals,
answer questions, and approve specs. Agents investigate, ask, and write specs, plans, and code, and
every step is checkpointed as plain text in git. The project is an early proof of concept: the
workflow ships as an agent skill, and the tools come later.

It works like an asynchronous [superpowers](https://github.com/obra/superpowers), with
[Spec Kit](https://github.com/github/spec-kit)'s file names where they fit: a capable agent does the
hard work upfront, autonomously, and the human only answers the questions only they can decide and
approves specs, in files built so their time goes into thinking, not searching. It targets technical
users for now.

## Constitution

Read `specs/CONSTITUTION.md` before any work. It holds the project's principles, ordered by
priority: when two conflict, the higher one wins. Its MUST and SHOULD rules are binding, and any
conflict with them must be resolved by a human. Only a human amends it: report a problem instead of
editing it.

## Understanding the workflow

- `skills/uraeda/SKILL.md` and its `references/`: the workflow, its source of truth.
- `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/`: the reference for what good
  artifacts look like. Read it before writing or changing a template, a reference, or an example
  file.
- `README.md`: user-facing, for people discovering the project. It describes what Uraeda is and
  links into the skill and the example. It holds no workflow rules: update it when a change to the
  workflow makes it wrong.
- `specs/PRIORITIES.md`: what is being worked on now, next, and later.

## Repository layout

- `skills/uraeda/`: the Uraeda skill, harness-agnostic, following the
  [Agent Skills format](https://agentskills.io/specification)
  - `SKILL.md`: the entry point that finds the current workflow step and stops at human gates
  - `references/`: one file per workflow step, and one each for the conventions, setting up and
    starting features, and the `ura` CLI
  - `assets/templates/specs/`: artifact skeletons, at the same paths as in a user's `specs/` folder
  - `assets/example/specs/`: a filled-in example project (todo app), at the same paths
- `specs/`: Uraeda's own workflow files. Not the templates installed in users' projects.
- `crates/`: Rust, in one cargo workspace
  - `core/` (`uraeda-core`): the workflow logic, parsing, validation, and states, shared by every
    tool
  - `cli/` (`uraeda-cli`): the `ura` binary
  - `binding/` (`uraeda-binding`): the core's Node binding, built with napi-rs
  - `lsp/` (`uraeda-lsp`): the `ura lsp` language server
- `packages/`: TypeScript, in one pnpm workspace
  - `binding/`: the binding's npm package, with its generated `index.js` and `index.d.ts`
  - `server/`: the Hono server on Node, serving fate's protocol at `/fate` and the built UI
  - `web/`: the React web UI, with Astryx components and fate
- `editors/`: editor plugins, reaching workflow files only through `ura lsp`
  - `nvim/`: the Neovim plugin, Lua, tested with mini.test
- `fixtures/`: workflow files shared by the Rust and TypeScript tests, some broken on purpose

The [stack](specs/decisions/stack.md) and [toolchain](specs/decisions/toolchain.md) decisions say
what goes where. Code marked `TEMPORARY:` is a placeholder that a named feature replaces: change it
freely, and do not build on it.

A change to the workflow touches the skill, its templates, and the example together: a step's
reference, its template, and the example's file must agree.

Markdown files can link to any file in the repository. Write markdown links with a relative path or
a path from the repository root (`/src/...`). Humans may also write wikilinks (`[[file-name]]`).

## Shell

- Commands run in zsh, where an unquoted glob that matches no file fails the whole command
  (`no matches found: --include=*.ts`). Quote globs, `--include='*.ts'`, or use `rg -g '*.ts'`.
- Run the toolchain inside the dev shell, `nix develop -c <command>`: outside it, `cargo nextest`,
  `stylua`, and other pinned tools are missing.
- The Vite+ section at the end of this file has no markers, so `vp install` no longer rewrites it
  (unwrapped, failing the format check). Edit it by hand, or copy a newer version from
  `node_modules/vite-plus/AGENTS.md`.

## Working with the human

- Give one complete response per turn. When a subagent's result matters to the answer, such as an
  adversarial review, wait for it, act on it, and only then respond, with its findings already taken
  into account. Never send a response and then a second one when the subagent finishes.
- Keep responses short: what changed, what the human must decide, and the next action.

## Authorship

Never mention a coding agent, a model, or an AI tool as an author or a tool used: not in commit
messages (no `Co-Authored-By` lines, no "generated with" footers), not in the README, not in any
file or pull request. This applies to every coding agent working on this repository. The work is
made by its human owner, who takes the decisions an agent executes, the same way a README does not
name the code editor it was written in.

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown,
Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend
tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through
`vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for
information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a
`vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do
different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the
project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+ release. Add a tool name
to select part of the graph. For example, run `vp toolchain vite`. Use `--global` to ignore the
local `vite-plus` package. Use `vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation,
      run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include
      its output when asking for help.
