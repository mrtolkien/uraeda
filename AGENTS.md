# Uraeda

Uraeda is a git-driven, opinionated software development harness. Humans write proposals, agents
research, ask questions, and write specs and plans, and every step is checkpointed as plain text in
git. The project is early: most of it is still design documents.

It works like an asynchronous [superpowers](https://github.com/obra/superpowers), with
[Spec Kit](https://github.com/github/spec-kit)'s file names where they fit: a capable agent does the
hard work upfront, autonomously, and the human only answers the questions only they can decide and
approves specs, in files built so their time goes into thinking, not searching. It targets technical
users for now: see "Vision" in `README.md`.

## Constitution

Read `specs/CONSTITUTION.md` before any work. It holds the project's principles, ordered by
priority: when two conflict, the higher one wins. Its MUST and SHOULD rules are binding, and any
conflict with them must be resolved by a human.

## Understanding the workflows

- `skills/uraeda/SKILL.md`: the workflow, the source of truth while the PoC is built. The workflow
  sections of `README.md` are obsolete.
- `specs/PRIORITIES.md`: what is being worked on now, next, and later.

## Repository layout

- `skills/uraeda/`: the Uraeda skill, harness-agnostic, following the
  [Agent Skills format](https://agentskills.io/specification)
  - `SKILL.md`: the workflow conventions and the entry point that finds the current workflow step
    and stops at human gates
  - `references/`: one file per workflow step
  - `assets/templates/specs/`: artifact skeletons, at the same paths as in a user's `specs/` folder
  - `assets/example/specs/`: a filled-in example project (todo app), at the same paths
- `specs/`: Uraeda's own workflow files. Not the templates installed in users' projects.

Markdown files can link to any file in the repository. Write markdown links with a relative path or
a path from the repository root (`/src/...`). Humans may also write wikilinks (`[[file-name]]`).

## Working with the human

- Give one complete response per turn. When a subagent's result matters to the answer, such as an
  adversarial review, wait for it, act on it, and only then respond, with its findings already taken
  into account. Never send a response and then a second one when the subagent finishes.
- Keep responses short: what changed, what the human must decide, and the next action.

<!--VITE PLUS START-->

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

<!--VITE PLUS END-->
