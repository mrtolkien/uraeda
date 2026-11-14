---
kind: change
finished: 2026-11-09
pull-request: https://github.com/mrtolkien/uraeda/pull/116
---

# Record: Postpone a feature or a change from its menu

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-09, finished on
> 2026-11-09, in [its pull request](https://github.com/mrtolkien/uraeda/pull/116). Its full files
> are in git: `git log -- specs/changes/2026-11-09-postpone-feature/`.

## What and why

Postponing existed only as a step of the skill, run when the human asked an agent for it: the
feature's menu had Rename and Drop alone. Postponing needs an agent, which writes the new proposal
from the feature's state, so the menu's "Postpone" sends that request to the feature's latest
session and opens it, for a feature or a change.

## Behaviour

- The page's "…" of a feature or a change holds "Postpone the feature" or "Postpone the change",
  between Rename and Drop, while it has a branch. It has no confirmation: the message goes at once.
- The message goes to the item's latest session, or to a new one when it has none, which then opens.
  A session's first message follows the usual chat opening. A send the server refuses, as when no
  agent is available or another of its sessions works, shows under the title, and the page stays.
- The message names the item, its folder, its branch, and the skill's "Postpone or block" step, and
  asks for its line in **Later**: `postponeMessage`.
- The skill's **Postpone or block** step covers a change too: its folder under `specs/changes/`, its
  `change/` branch, and a proposal that says it was a change, to start again as one. An agent in the
  item's worktree writes the default branch in the main checkout, with `git -C`, and leaves its own
  worktree in place, giving the human `git worktree remove <path>`, as **Drop** does: the item's
  sessions keep their folder.

## Design

The menu reuses `sendMessage` ([sessions.ts](/packages/web/src/sessions.ts)), whose message to a
folder goes to its latest session, or makes the first one, on the server
([send-mutations.ts](/packages/server/src/fate/send-mutations.ts)): no new endpoint.

- [FeatureMenu.tsx](/packages/web/src/feature/FeatureMenu.tsx): the menu item and `usePostpone`,
  which sends once at a time, opens the session, or passes the refusal to the title's banner.
- `postponeMessage` in [round-messages.ts](/packages/server/src/runner/round-messages.ts), free of
  Node's modules, shared by the server and the UI.
- **Postpone or block** in
  [projects.md](/skills/uraeda/references/projects.md#postponing-or-dropping-a-feature), with the
  descriptions of `specs/proposals/` in [SKILL.md](/skills/uraeda/SKILL.md), the template
  [README.md](/skills/uraeda/assets/templates/specs/README.md), and
  [the specs folder's docs](/docs/specs-folder.md); the menu in [the web UI's docs](/docs/app.md).
- Tests: [postpone.test.tsx](/packages/web/src/__tests__/postpone.test.tsx), for a feature with and
  without a session, a change, and a refusal; the message in
  [message.test.ts](/packages/server/src/runner/__tests__/message.test.ts).

## Gotchas

- **The worktree stays**: the agent runs inside the item's worktree, and Drop archives a dropped
  item's sessions on the server, which nothing does for a postpone. Removing the worktree would
  leave the session the human reads on a folder that is gone, so the step leaves it to the human.
- **Writes outside the worktree**: the commit on the default branch is an action outside the
  session's worktree, which the [agents](/specs/decisions/agents.md) decision has reviewed before it
  runs, so a postpone may ask the human to allow it in the session.

## Changes after approval

- The human asked in the session for the option on changes too, for the message sent at once, and
  for a new session when the item has none.
- The review moved the worktree's removal to the human, and added the change and refusal tests.

## Follow-ups

- Postpone is on the item's page alone, not in a session's "…": the session's actions could take the
  same hook.
- A postponed item's sessions are not archived, and its worktree waits for the human: the server
  could notice the closing commit and do both, as Drop does.
