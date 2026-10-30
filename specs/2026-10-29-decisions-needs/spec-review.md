---
verdict: changes-requested
commit: 28e423d
---

# Review: Spec, Decisions understandable with no context

## C1: Decision git, lines 22–23, under "Rules"

> - A branch's step MUST be read only from its latest commit, never from files on disk. Checked by
>   the core's workspace tests.

Small change here: this is not a MUST because we want the "step detection" to work even in weird
corner cases and be extremely robust. git is a bit too slow for that. Make it a SHOULD and remove
the "never"
