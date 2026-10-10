# CLI core features

Standard CLI:

- Init folder with template files for constitution and priorities + folders
  - `ura init`, should be from workspace root
- Check status w/ optional JSON output
  - `ura status` -> current ongoing features and their status CLI + TUI:
- Priorities.md bullet point to draft with TUI to pick the right priorities line
  - `ura draft`
  - The goal is to quickly pick an existing line written in priority and start working on it in a
    real file
  - The TUI then exits and open the created file with $EDITOR
- Answer clarifications questions one by one (left/right to change question), with auto skip of
  irrelevant questions (1.B if 1.A was picked for example)
  - `ura answer` -> interative picker if multiple features are waiting for answers, otherwise open
    the questions directly
  - Interface should roughly be:
    - Render the intro up to the first question, J/K, +/-, up down for vertical movement
    - Right/L goes to the first question, left/right lets us navigate between questions, ... also
      allow vi motions
    - Typing ASCII characters goes directly in the response box, shift + enter for line jumps if
      possible
      - While typing left/right are for character navigation, enter/escape validates, and left/right
        becomes useful for navigation again
    - ctrl + g opens the $EDITOR to write down the response (like it does in codex or claude code)
    - Some form of bottom reminder of shortcuts/mode so people are not lost. Take inspiration from
      lazyvim's bottom bar, you can look at my nvim conf
- Approve/comment on specs or plan
  - `ura review` -> show picker if needed -> show the rendered file -> `Y` approves, `R` refuses,
    `J/K`, `+/-`, and up/down arrows navigate the line. `C` comments, NOTING THE ACTIVE LINE.
  - Same as above: iterative picker only if there are multiple unapproved files.

We should then tell our skill/reference files to use the CLI for all workflow steps which will be
less error prone than telling an agent what it needs to do.

Use ratatui for TUI. Make the TUI coherent and beautiful: look for inspiration and make a mock.

The above controls and cli commands are guidelines, not hard specs: if you think they are bad,
clearly tell me why and suggest an alternative.

If you think a command is clearly missing, please propose it in the clarifications.

## Note

- Does adding "approve with comment" or "refuse with comment" change the flow anyhow? That would
  become an option.
- I'm adding the "comment line X" option to the spec review flow: this is more natural and closer to
  what's really done in a review, for example in Github PRs
  - How to integrate that with our text-first approach? A secondary `spec-review.md` with
    [[spec.md#^50]] or something similar for a link to a line or a header?
