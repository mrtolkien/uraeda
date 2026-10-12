# Claude Code runner (triggered manually)

## What

Drive claude code from inside the server: https://code.claude.com/docs/en/headless

## Why

With this, there's no need to drive a claude code session ourselves (which is what I've done so far)

## Notes

- Use a single claude code session for the whole feature, it will use sub-agents itself. Resume the
  session on subsequent turns.
- Make sure the claude code instance has access to the uraeda skill
- It can be driven with messages like "Follow the uraeda flow and start working on the UI
  improvements", "Clarification questions have been answered, create the spec", "Spec is approved,
  move to plan", ... You can also directly integrate the relevant reference files in the prompt.
- Add a toggle in the UI to enable remote control in the session if that's possible with headless
  claude code.
- In UI actions that commit and would trigger the next workflow step, show both options: "Commit and
  start/continue work on the session" or "Commit only".
