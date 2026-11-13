---
icon: flask-conical
---

# Sandbox

> "What I want is to use the sandbox (`nix develop -c just sandbox`), point out issues to you, and
> have you fix them _as fast as possible_. Velocity is paramount."

The sandbox is the whole app, hot-reloading from the code of the checkout it runs in, over sample
projects and a fake agent, which answers from canned text and changes no file. It is where the human
reviews the UI.

## Rules

- The sandbox never reads or writes the human's real repositories, data folder, config folder, or
  agent. _So:_ its sessions run on the fake agent, and every test, picture, and tool run gets
  folders of its own, and fails when it wrote in the human's.
- The sandbox always has a picker: a way to point at an element and copy, as text for the agent,
  what it is and where. _So:_ a move of the app to another framework brings the picker with the
  sandbox. When the move to Native Shell dropped it, the human asked for it back the same day.

## Why

The human finds what is wrong in the UI by using it, and a fix goes fastest when they can point at
an element instead of describing it. UI work needs the app in many states: sample projects give them
without risk to real ones, and a fake agent costs nothing and answers the same every time. History:
[UI sandbox](../done/2026-10-20-ui-sandbox.md).

## Alternatives considered

- Dropping the picker where a framework gives no source location of an element: done once, and
  reversed. A pick that names the file and the component that wrote the element is enough.
- The real agent on the sample projects: costly, slow, and never the same twice.

## Applies to

- [`crates/server/src/sandbox/`](/crates/server/src/sandbox/) and [`app/sandbox/`](/app/sandbox/),
  and every feature with UI work
- Every feature that adds a workflow step or file, which the sample projects must show

## Revisit when

The human decides whether Uraeda keeps its own app, or sits on another orchestrator with its skill,
its CLI, and a small view: they asked on 2026-11-13 how much custom UI it needs, and it is open.
