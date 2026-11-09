# Rulings: Postpone a feature from its menu

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: Changes get Postpone too, and the skill's step covers them

- **Decision**: "Postpone the change" sits in a change's menu, as "Postpone the feature" in a
  feature's. The skill's **Postpone or block** step now covers a change: its folder under
  `specs/changes/`, its `change/` branch, and its proposal started again as a change.
- **Rationale**: asked by the human in the session that started this change, with the next two
  rulings: "Changes should also have the option".
- **Where**:
  [projects.md](/skills/uraeda/references/projects.md#starting-postponing-and-dropping-a-feature),
  [FeatureMenu.tsx](/packages/web/src/feature/FeatureMenu.tsx)

## R2: The message goes at once, to the latest session, or a new one

- **Decision**: Postpone sends its message without a confirmation, to the item's latest session,
  made when it has none, then opens it. The menu item has no "…", as nothing asks before it goes.
- **Rationale**: the human's answers in the session: "The prompt is sent right away" and "If the
  feature has no session, create one". The agent stops on its own when the worktree or the folder
  has uncommitted changes, as the step says.
- **Where**: [FeatureMenu.tsx](/packages/web/src/feature/FeatureMenu.tsx), with `sendMessage` from
  [sessions.ts](/packages/web/src/sessions.ts)

## R3: The message moves the line to Later

- **Decision**: the message asks for the item's line in **Later**, the step's default for one not
  scheduled; it names "Postpone or block" in the skill's projects reference, and stops when it is
  postponed.
- **Rationale**: the menu asks nothing, and blocked work, which goes after what it needs, is rare
  enough to say in the session.
- **If wrong**: the human tells the agent where the line goes, in the session it opens.
- **Where**: `postponeMessage` in
  [round-messages.ts](/packages/server/src/runner/round-messages.ts), shared by the server and the
  UI

## R4: Only on the feature's page, and only with a branch

- **Decision**: Postpone is in the page's "…", not the session's, and only while the item has a
  branch for the agent to close.
- **Rationale**: the proposal names the feature's menu. A session's "…" acts on that session, and a
  feature without a branch has nothing to postpone on it.
- **If wrong**: the session's actions take the same item, from the same hook.
- **Where**: [FeatureMenu.tsx](/packages/web/src/feature/FeatureMenu.tsx)

## R5: The agent's writes on the default branch are reviewed

- **Decision**: no new permission for the session: it runs in the item's worktree, so its commit on
  the default branch, in the main checkout, is an action outside its worktree, which the human
  allows from the session, as the agents decision asks.
- **Rationale**: the [agents](/specs/decisions/agents.md) decision: each action outside the worktree
  is reviewed before it runs.
- **If wrong**: a postpone needs one or two approvals more than a run in the main checkout would.
- **Where**: [claude.ts](/packages/server/src/runner/claude.ts), unchanged
