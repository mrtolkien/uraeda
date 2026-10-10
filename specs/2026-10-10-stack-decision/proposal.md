# Technical stack decision

## What

Choose the stack for uraeda's 3 main components:

- CLI
- Frontend
- Orchestrator / backend

Investigate full TypeScript, full Rust, and using a mix of both. Make sure you really think through
all options, search for opinion online, and use sub agents for adversarial review of your opinions.

The deliverable is a repo with a basic skeleton for all 3 components that builds and has good
practices set up (single comment at root to run all tests and checks, ...)

## Why

The repo organization and programming languages need to be decided before building the CLI and the
web UI.

## Notes

- The frontend can be mostly independent, logic should live in the CLI and backend.
- I'd like to share code between CLI and backend to not re-implement the same logic twice.
- I want the CLI to be simple to install even without a package manager. Ideally it should compile
  to a small native binary.
- For the frontend I don't want to reinvent the wheel and waste time on making tons of custom
  components: I think React with Astryx components will go a long way towards making the app look
  coherent fast. I also want it to be ridiculously fast, and maybe to compile to native in the near
  future.
- The backend will need to interface with Codex, Pi durable, and Claude Code. It should also be a
  language that has good tools for working with docker/nix, as that's an important later feature for
  execution environments. Git (or jujutsu?) too would be great if it could be included in the
  binary, but that's not vital.
- Looking at all that, it feels like doing it all in TypeScript is the obvious pick: one "common"
  logic module and 2 modules per program.
- I personally would much prefer Rust for the CLI and backend, as I feel like it's better for small
  binaries and it usually has better support for properly defining workflows and states in code
  through its enum type. I also really like cargo workspaces for a project like this. For the
  frontend we could go with Dioxus, Leptos, or topcoat, or keep the frontend React.
