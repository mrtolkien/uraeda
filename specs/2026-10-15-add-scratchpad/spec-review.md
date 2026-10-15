---
verdict: approved
commit: dd1ef96
---

# Review: Spec, Inbox

Importantly, the bugfixing flow needs to be merged before this feature can be done.

The bugfixing feature is in development and will be merged ahead of finishing this one: the last
step of the development should be pulling in the changes of the bugfixing flow and integrating
nicely with them.

## C1: Lines 22–23, under "Spec: Inbox"

> > - **Your note "Three bugs: Remove them"**, read as: no fix of their own. They go away with the
> >   `## Scratchpad` section, which leaves `PRIORITIES.md`.

You know what, don't do anything to it. Just move the scratchpad to INBOX.md

## C2: Lines 203–204, under "US7: Write notes from Neovim (P3)"

> In Neovim, the human runs the plugin's "Add a note" action, types the note and an optional
> category, and the language server writes it to the inbox on the default branch.

After typing the note, there should be a category picker, then it should open the INBOX.md file
focused on the line that was just added
