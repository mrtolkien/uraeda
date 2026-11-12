---
status: active
approved-by: mrtolkien
icon: flask-conical
---

# Sandbox

Uraeda's built UI is reviewed in a sandbox: the whole app, hot-reloading from the code of the
checkout it runs in, over sample projects and a fake agent. It never touches the human's real
projects, data, or agent. The gallery stays the place for mockups and variants, and the sandbox is
where pages are browsed together, as a user does.

## Rules

- The sandbox MUST show the whole app from the checkout it runs in, with hot reload, over sample
  projects only.
- The sandbox MUST NOT read or write the human's real repositories, data folder, config folder, or
  agent. Checked by a test.
- The sandbox's sessions MUST run on a fake agent, which answers from canned text and changes no
  file. Checked by a test.
- The sandbox's state MUST survive its restarts, until the human asks for a reset. Checked by a
  test.
- The sandbox's sample projects MUST NOT reach the package, and its command MUST stay hidden there:
  it runs from a checkout only.
- Mockups and variants SHOULD stay gallery pages, as [Preview](preview.md) says.

## Why

UI work needs the app in many states, and the gallery's pages show components alone, never a way
from page to page. A fake agent costs nothing, answers at once, and answers the same every time.
State kept until a reset brings the human back where they were. History:
[UI sandbox](../done/2026-10-20-ui-sandbox.md).

## Alternatives considered

- A sandbox mode inside the development server: sample and real data in one app.
- The real agent on the sample projects: costly, slow, and never the same twice.
- A picker that copies an element's page and source location for the agent, which the web UI's
  sandbox had: its build plugin went with that UI, and Native Shell has none.

## Consequences

- Every UI feature can be reviewed in the sandbox, at every step of the workflow.
- The sample projects need upkeep as the workflow's files and steps change.
- A step never moves on by itself in the sandbox: the human sees an agent at work, not its result.

## Applies to

- [`crates/server/src/sandbox/`](/crates/server/src/sandbox/), `ura sandbox`, `just sandbox`, and
  every feature with UI work
- The builders of the sample projects, in the same folder, and every feature that adds a workflow
  step or file
