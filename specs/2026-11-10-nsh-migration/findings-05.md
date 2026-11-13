---
reviewed: branch
commits: 2ebbc5e387ff11f4af86c131d8cc26800a813af4..8e102bfdc8563394b6395fb4521f410e44840222
---

# Findings: nsh-migration, the branch

## Claude Code · Fable 5.2

3 findings, most severe first:

1. `app/ui/surfaces/backCloses.ts:56`: In a phone's browser, a sheet that closes and then opens a page loses the page: closing calls the browser's `history.back()`, which is asynchronous, and the `pushState` of the navigation that follows runs before it.

   Failure scenario: Phone browser, a field with unsaved text, tap a link: the 'Leave page?' sheet opens as a visit. Tap 'Leave page': `asking.set(null)` closes the sheet (`closed()` queues `history.back()`), then the guard's promise runs `open(next)` and pushes the new page. The queued back then lands on the old page's entry, so the owner is bounced back to the page they chose to leave. Same order in `app/screens/runs/ContinueDialog.tsx:66-67` (`onClose()` then `navigate`: the run starts but the session never shows) and `app/screens/feature/Postpone.tsx:31-32`. Leaving by Back with unsaved text is hit too: two `history.back()` calls are queued, the first popstate consumes `leaving`, and the second asks again. `nsh test` and GTK use `memoryHistory`, whose `back()` is synchronous, so neither shows it; the phone walks only test Back closing a sheet. Not run in a browser: derived from the code and the History spec. Smallest fix: in `history.ts`, mark an overlay's back as pending and hold `navigate`/`open`/`back` until its `arrive`; or drop the overlay visit with `replace` instead of `back()` when a navigation follows.

2. `app/ui/text/TextField.tsx:307`: A field removed while it has the focus now never calls its owner's `onBlur`, and two owners save only there, so their typed text is not saved when the field goes with the focus.

   Failure scenario: GTK, where a click on a non-focusable view may leave the editor focused: edit a scheduled job's time or prompt (`app/screens/jobs/Typed.tsx:54`, `onBlur={() => void leave()}`), then click another page in the rail. Cleanup sets `gone`, blurs the editor, and the blur returns before `leave()`. The job keeps its old value while the form, on return, shows the typed text from the device's unsaved store, so it reads as saved. Same for the server's Port (`app/screens/settings/Server.tsx:180`). Not lost: the round's comment and notes save in their own `cleanup` (`Question.tsx:83`, `End.tsx:83`), and the review's comment stays on the device and says so. Whether GTK blurs on such a click was not run. Smallest fix: `cleanup(() => void leave())` in `Typed` and the same for the port, as the round's fields do.

3. `crates/server/src/start.rs:132`: A start that finds the lock held and a status file present refuses at once when that server does not answer; the 2 s wait only covers a lock held without a status file.

   Failure scenario: `ura serve` gets Ctrl+C and spends seconds stopping (agents killed, up to 5 s `GRACE`): it no longer accepts connections, but its status file is removed only at the end of `stop()`. The owner opens the app meanwhile: `Local::ensure` finds no answer, starts `ura serve`, whose `hold()` reads the status, gets a refused connection, and exits with 'held by the Uraeda server at … which did not answer: stop it'. The app shows 'Uraeda's server stopped as it started' for a server that is gone a second later. Same if a second start reads a crashed server's stale status file while a new one holds the lock just before writing its own. `crates/server/tests/one_server.rs:60-77` asserts this immediate refusal, so the test changes with the fix. Smallest fix: when `hand_over` returns no answer, go back into the loop and poll the lock until the deadline, refusing only then.

Nothing here touches sign-in, the agents' runs or the protocol. The first finding is the one I would hold the merge for if the phone's browser is used daily; the other two are for the owner to know. I ran no tests or builds: everything is from reading the code.

**Checked and found sound**

- **Data folder lock:** it is taken before the status file and the stores, and freed on every failed start path. A crashed server's lock goes with its process, since the lock file is opened close-on-exec. The explicit unlock in `Drop` cannot free another server's lock.
- **Gone-folder watch (`records/watch.rs`):** dropping a watch from its own callback does not deadlock, the watches are cleared at stop, and a folder moved back is seen from the nearest existing parent.
- **Protocol 3:** the Rust constant, the generated `protocol.d.ts` and `connection.ts` agree. The reasons test fails to build when a reason is added without raising the version, and the refused-connection test now derives from `PROTOCOL`.
- **Unsaved text during a save (`unsaved.ts`):** text typed back while a save is pending survives whichever of the record and the answer comes first, and the kept entry is dropped once the last save answers.
- **Tab and focus:** Tab stays in the focused pane, Enter and Escape go to the focused control only when no layer or sequence is open, and any other key gives the pane its keys back. I found no keyboard trap.
- **Git page's `s`:** one binding for the pane, filled by the file shown, so the double registration is gone.
- **Crate updates:** the only code change is `set_position(Some(..))` for toml_edit 0.25. gix and rusqlite changed no code: I checked the manifests and commit messages only, not their behaviour at run time.
- **Tests:** none weakened in the 95 commits. The removed leader-menu cases match the new ruled behaviour, and `layers.rs` asserts it reaches more than 50 files, so it cannot pass empty.
- **nextest:** the 10-minute override is scoped to `host::` tests only.
- **Sign-in and routes (sampled):** one list of open routes with everything else answering 401, the Host guard, and child processes started from a cleared environment are still in place.
- **CI and docs:** the workflows run only `nix develop -c just …`, with no Node, pnpm or Vite step. The docs name no stale toolchain version. No added file in the range should be untracked.
- **R531:** the dead visit left when a sheet's action opens a page is already ruled there, so I did not repeat it.

## Codex · GPT-6.1-Sol

Inspection found the sampled route/host guards, hashed pairing credentials, protocol-3 wiring, and Node-free release wiring sound.
Sampled extension-header stripping, queue-shutdown handling, and pending-save delivery-order fixes remain present.
The import race needs fixing before merge; tests could not run because Nix's cache is read-only in this sandbox.

Full review comments:

- [P1] Acquire the data-folder lock before importing sessions — /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/cli/src/import_sessions.rs:25-29
  If the app starts its server after the import's `status::running` check, both processes can open the destination store: the importer never acquires the new advisory lock. With `--replace`, it can then delete sessions underneath a running server whose cached turns and automatic continues still reference them. The already-running-server check fixes the sequential case but not this race. Acquire the same data-folder lock before `Store::open` and retain it through import and close.

- [P2] Restrict focused-control dispatch to the active pane — /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/surfaces/focus.ts:214-217
  With two panes visible, Tab to a button in one pane, then click non-focusable content in the other. The layout switches its focused pane, but the focus ledger retains the first pane's button. This check accepts any pane's stops, so the next Enter invokes that old button instead of the newly focused pane's action. Clear the control focus when the active pane changes, or check that the held stop belongs to the active pane before dispatching Enter.

- [P2] Keep the feature's bottom-bar action outside the Overview lifetime — /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/feature/Overview.tsx:159-162
  On a phone, opening Steps, Sessions, Decisions, or Figures unmounts Overview because only the selected pane is drawn. This cleanup consequently removes the feature's Continue/Next action from the bottom bar, although `actionOf` explicitly searches all the page's panes for that action. It returns only after reopening Overview. Keep the action and its dialog handling in a feature-page scope that survives tab changes rather than publishing them from `NextPart`.
