---
discovery: low
---

# Inbox quick fixes

## What

Fix the easy deferred notes from the inbox, the ones that need no input from me:

1. Trim `skills/uraeda/SKILL.md`: it has 5 characters of margin under its 20,000 limit.
2. A change's blocking banner reads "This feature cannot go on".
3. A record from before typed commits reads "Not found on the default branch", a squash merge's
   words, though nothing was squashed.
4. A done feature's "Next" names its pull request without linking it; only "Lines changed" leads
   there.
5. Sidebar: a card's "+N −N" draws uncoloured: Text's success and error colours are not defined by
   the theme.
6. Sidebar: on main, the browser test "the sidebar with sessions, searched for “”" fails on desktop:
   the chat row "Tag v0.3.0 and push the tag." overflows its row (243 > 214 px).
7. Benchmarks: the record's repository commit is read at the end of a run, not the start
   (run-common.ts), and the leak audit sees only http(s) addresses: gh repo clone, gh api, and ssh
   remotes pass (session.ts).

## Why

They were left in the inbox as deferred fixes. Each is small, and together they clear the inbox.
