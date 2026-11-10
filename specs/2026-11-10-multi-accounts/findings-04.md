---
reviewed: wave 4
commits: 9f34aa5cd375ce43069c6507f905eafd3c64ea4a..c8ae267892115648fa7f112c745c2e1b6f027c61
---

# Findings: Multi-accounts management: auto rotation between multiple claude logins, wave 4

## Claude Code · Fable 5.2

Spec compliance holds on the main paths: the script in `docs/web-ui.md` is the spec's, whole; the
header joins "Claude Code · b · Opus 5.5 · High" and names no account when there is none; Home and
the sidebar read as US2 and US3 say for ready and signed-out accounts; the documentation carries the
API key, usage credits, MCP servers per folder, and the terms sentence; and the mockups now render
`UsageBody`, `AllowancePane`, and `SessionHeader` with the approved layout. The gaps and quality
findings follow, by reading the code only: nothing was run.

9 findings, most severe first:

1. `packages/web/src/UsageWindow.tsx:167`: Spec (US2, C1): the sidebar takes
   `runtime.usage.slice(0, 1)` as the five hours, but a runtime without accounts orders `usage` by
   which window was first reported and drops expired windows, so the first one can be the week.

   Failure scenario: Codex's five-hour window passes its reset (or its process reported the week
   first) while its week is still open: `processes.usage` gives [week] or [week, 5h], and the
   sidebar shows "Week 60% · Wed 18:38" for Codex, which US2 and C1 forbid ("no week", for Codex too
   and with no account listed). Before this commit the sidebar listed every window, so the order did
   not matter.

2. `packages/web/src/UsageWindow.tsx:126`: Spec (US3): an account whose folder is missing (state
   "missing") reads "signed out" on Home and in the sidebar (line 140), since `isReady` folds both
   non-ready states into one text.

   Failure scenario: `~/.claude-c` is listed and deleted: the settings banner says "account c has no
   folder at ~/.claude-c", while Home reads "c · signed out" and the sidebar "c signed out". The
   human runs `claude auth login` for a folder that does not exist; US3 says the panes "say so" for
   both problems.

3. `packages/web/src/sidebar/Allowance.tsx:71`: Spec (US2 key 3): the rail's bar falls back to the
   `isNext` account whenever the session's own account is not found by name, so a session in view
   can show another account's five hours.

   Failure scenario: A session runs on `b`, then `b` leaves the list (edge case: the session keeps
   it); or a session made before the feature has `account: null` on a runtime that now lists
   accounts. `own` is undefined, and the bar shows the account a new session would start on, say `c`
   at 80% left, while the session in view is refused on `b` or runs on the server's own login. The
   fallback should apply only when no session is in view (DefaultBar); a session with an account not
   listed should show no bar.

4. `packages/web/src/UsageWindow.tsx:138`: Spec (US2): the sidebar's line and the rail's bar
   (`Allowance.tsx:72`) take `account.windows[0]` as the five hours, but `accountUsage` puts a
   window the ask never gave after the others, in report order, so the first can be the week.

   Failure scenario: An account's usage ask fails (askedAt null, no windows) while a running session
   on it reports its `seven_day` limit before its `five_hour` one: `windows` is [week] or [week,
   5h], the sidebar reads "b Week 66% · Wed 18:38", and the rail's bar draws the week. The server
   should guarantee the order, or the view should not rely on position.

5. `packages/web/src/UsageWindow.tsx:81`: Spec (US3 key 3): the error colour on the words needs
   `remaining === 0` exactly, while the text shows the rounded `left`, so a line can read "0% left"
   without the error colour.

   Failure scenario: A week reported at used = 0.996 (or any share between 0.995 and 1): Home reads
   "Week 0% left - reset Wed 18:38" in the secondary colour with a fill 0.4% wide that cannot be
   seen, where US3 wants 0% in the error colour. Compare `left === 0` instead.

6. `packages/web/src/sidebar/Allowance.tsx:113`: The rail bar's label and title name the window only
   ("5h: 58% left"), never the account it belongs to, though with accounts the bar changes account
   with the page in view.

   Failure scenario: Three accounts listed, the sidebar folded: hovering the bar reads "5h: 12%
   left" on a session page and "5h: 100% left" on Home, with nothing saying the first is `c` and the
   second `b`; a screen reader gets "5h allowance remaining" for both. The compact line already
   labels its window `${account.name} ${first.label}`; `barWindow` could return the same.

7. `docs/web-ui.md:735`: Documentation: the new section never says how an account gets its name, nor
   what the sidebar shows for an account signed out, though it uses "b" and the UI shows "default".

   Failure scenario: A reader lists `~/.claude` and `~/.claude-work` and sees "default" and "work"
   in the panes and the header, or a full path for a second folder of the same name, with no
   sentence explaining the rule US2 states ("its folder's name without its dot and its `claude-`";
   `~/.claude` reads "default"). The documentation decision asks the page to be updated where a
   change makes it incomplete.

8. `packages/web/src/AccountsMockups.stories.tsx:92`: The stories' fixed records contradict the
   server's rules: `default` is `isNext` while `b` is unused, and `b`'s unused five hours carries a
   reset time, so no story shows the "5h 100% left" line without a reset.

   Failure scenario: The pick (SC-001) would mark `b` as next with these numbers, and Claude Code
   gives no reset for a window not open (Assumptions; US2 more 1). The mockup shows "b 5h 100% ·
   19:40", a line the real app never draws, and the `resetsAt: null` branch of `UsageWindow`, new in
   this commit, has no story to review it by, where views have no tests.

9. `packages/web/src/sidebar/Allowance.tsx:135`: Cleanup: `SessionBar` reads the same session
   request twice, through `useSessionAccount` and `useSessionRuntime`, two hooks that each call
   `useRequest` and `useLiveView` on `SessionAgentView`.

   Failure scenario: Two subscriptions and two suspense reads of one record for every render of the
   bar, and two hooks to keep in step when the view changes. One hook returning
   `{ account, runtime }` from a single read does the same job; `useSessionAccount` has no other
   caller.

## Codex · GPT-6.1-Sol

Spec compliance: two reproducible usage-display cases violate US2. Quality: no additional actionable
defects found; full validation was blocked by the read-only Nix cache.

Full review comments:

- [P2] Select the five-hour window explicitly in the sidebar —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/web/src/UsageWindow.tsx:166-167
  For Codex without configured accounts, a valid secondary-only report produces
  `usage = [seven_day]`; an expired five-hour report can also leave only the week. Slicing the first
  element therefore displays the week in the sidebar, contrary to US2's five-hours-only requirement.
  Select the five-hour window by identity rather than position, leaving the week on Home.

- [P2] Reserve the next-account fallback for views without a session —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-multi-accounts/packages/web/src/sidebar/Allowance.tsx:70-72
  When an existing session's account leaves the configured list, `own` is undefined and the rail
  silently shows the next account's allowance, although that session keeps its original account.
  Legacy accountless sessions also incorrectly show the next configured account. US2 requires the
  rail to follow the session in view; use `isNext` only when no session is being viewed, and omit
  the bar if that session's usage is unavailable.
