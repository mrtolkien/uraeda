---
verdict: changes-requested
commit: c672d3f
---

# Review: Spec, Multi-accounts management

## C1: Line 124, under "US2: See each account's usage (P2)"

> [The sidebar's Usage pane, three accounts](/packages/web/src/AccountsMockups.stories.tsx#SidebarThreeAccounts)

Story AccountsMockups.stories.tsx#SidebarThreeAccounts, desktop, element with “Week 60% · Sat
17:11”: Remove the week from the sidebar. Only home.

## C2: Lines 61–68, under "US1: New sessions start on the account with the most left (P1)"

> ```sh
> mkdir ~/.claude-b
> for item in settings.json CLAUDE.md skills plugins commands agents hooks statusline.sh projects; do
>   [ -e ~/.claude/$item ] && ln -s ~/.claude/$item ~/.claude-b/$item
> done
> CLAUDE_CONFIG_DIR=~/.claude-b claude auth login
> CLAUDE_CONFIG_DIR=~/.claude-b claude auth status
> ```

The recipe should be the shell script you made in our chat.

I added claude-gary and claude-leo and claude-tato, you can use them for smoke tests during dev.

## C3: Lines 149–151, under "US3: Know when an account needs you (P3)"

> An account that is signed out, or whose folder is missing, is never picked. A banner of Settings,
> Extensions names it, and the usage panes say so. An account whose week is used up shows its week
> in the sidebar, which is why no session starts on it.

Week only in home
