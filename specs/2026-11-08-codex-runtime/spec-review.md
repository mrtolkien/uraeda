---
verdict: changes-requested
commit: ae986b4
---

# Review: Spec, Codex runtime + model settings

## C1: Decision models, lines 15–16, under "Rules"

> - A session MUST keep the agent, the model, and the effort it started with, its automatic runs
>   included. Checked by the runner's tests.

Effort can be changed mid-session.

## C2: Lines 88–90, under "US2: Pick the model and effort a session runs on (P1)"

> Where a session starts, one button names the agent, model, and effort it will run on. It opens a
> menu of the agents on here, then the agent's models, then the picked model's efforts, "Default"
> first in each.

I really don't like those big radio buttons:

1. Style them in the same style as the rest of the app: no rounds, just squares. We already have
   checkboxes in git
2. Keyboard navigation: this doesn't look very keyboard navigatable

## C3: General

Btw you're allowed to run actual codex during the development to validate behaviour. No issues, you
can use it as much as needed.
