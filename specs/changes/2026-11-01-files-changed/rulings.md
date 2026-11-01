# Rulings: The Changes panel misses files written by shell commands

The low-impact choices made while building [the change](proposal.md), inside the limits of
[its round](clarifications-01.md) and the decisions. None binds future work: those are decisions.

## R1: The new text shows before the first message too

- **Decision**: Changes reads "No file edited by a tool. Files written by shell commands are not
  listed." both while the session edited no file and before its first message.
- **Rationale**: both cases come from the one `Nothing` component of
  [`ChangesPanel`](/packages/web/src/session/ChangesPanel.tsx), and the sentence holds true before
  any turn. One empty text keeps the panel saying the same thing whenever it is empty.
- **Alternatives considered**: keeping "No file changed yet." before the first message. It reads
  better there, but gives the panel two texts for the same nothing.
- **Where**: [`ChangesPanel.tsx`](/packages/web/src/session/ChangesPanel.tsx)

## R2: No test for the text

- **Decision**: the change adds no test. It was reviewed in the running app instead.
- **Rationale**: the change is one sentence of copy, and the panel has no rendering test to extend.
  The [testing](../../decisions/testing.md) decision allows a UI test only for behaviour costly to
  lose that using the UI would not catch. An empty panel's text shows at a glance.
- **If wrong**: a test that renders `ChangesPanel` with an empty session would check the text.
- **Where**: [`ChangesPanel.tsx`](/packages/web/src/session/ChangesPanel.tsx)
