---
verdict: changes-requested
commit: ac4a783
---

# Review: Spec, Vim in text edit mode

## C1: Lines 249–252, under "Architecture"

> - **The Commit page** lists every Markdown file under `specs/` changed and not committed, beside
>   the lists and the proposal files it lists today, and, in a group per feature, the files changed
>   on that feature's branch. It commits the default branch's and each feature's apart, each with
>   its own message, and Discard drops them as it does today. The core lists them, and owns the
>   messages.

So:

1. Each branch/worktree should commit individually: if there are changes on main AND a worktree,
   there should be two sets of changes and two "commit" buttons. Separate them with panes. It will
   come up rarely but hey.
2. We should the option for the user to input the commit's text if they want to change it.
