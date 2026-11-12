---
reviewed: branch
commits: 7f30e4efcdb79e934a4ecc211712bd47f200a5ca..183dac038935f8646f59eb166f20549a21abea5a
---

# Findings: nsh-migration, the branch

## Claude Code · Opus 5.5

7 findings, most severe first:

1. `crates/server/src/preview/ahead.rs:68`: The look-ahead warm job runs as a `spawn_blocking` task
   that sleeps in a loop for up to 180 s per folder, and the shutdown path cannot cancel it.

   Failure scenario: `run` stops waiting for the job when `shared.stopping()` fires and returns, but
   the blocking task keeps polling `awaited` (`std::thread::sleep`, `PATIENCE` = 180 s) per folder
   and per story. The Tokio runtime waits for blocking tasks when it is dropped, so `ura serve` or
   the app's owned server can hang for minutes on SIGTERM while a Storybook warms. The app's
   `Local::stop` gives the server 10 s and then kills it. That kills Storybook children mid-start
   and skips the queue and `on_stop` cleanup. A `stopping` flag should be checked inside `awaited`.

2. `crates/app/src/server_start.rs:92`: `Local::ensure` holds the `started` mutex for the whole
   start wait (up to 60 s), and `stop()` and `running()` take that same mutex.

   Failure scenario: The human opens the app and closes the window while the first start is still
   reading repositories and building extensions. `Host::stop` calls `local.running()` and then
   `local.stop()`, which sets `closing` but blocks on the mutex until `ensure` returns. `ensure`
   never checks `closing` inside its loop. The window hangs for up to a minute. A UI-thread call to
   `running()` freezes the same way.

3. `crates/server/src/files/raw.rs:91`: `with_pick` inserts the pick script at byte 0 when the page
   has no `</head>`, which puts it before the `<!doctype>`.

   Failure scenario: A mockup HTML file with no `</head>` (a fragment, or a head-less
   `<!doctype html><body>`) is served with `<script>…</script>` ahead of the doctype whenever it is
   loaded with `?uraeda-pick`. The browser renders it in quirks mode, so the mockup looks different
   while picking than when viewed normally, and comments are made against a different layout. The
   first `<head>`, `<body>`, or `<html …>` tag is the safer insertion point. The search for
   `</head>` also matches inside an earlier comment or script string.

4. `app/extensions/host.tsx:117`: A page's `navigate` takes any address of the app, and its `record`
   and `call` payloads are cast without validation.

   Failure scenario: An extension page, which is the owner's code but may be third-party, posts
   `navigate` with `{ to: "/r/other/…" }`. `parseRoute` accepts it, so the page can drive the app to
   any pane, repository, or settings or devices screen without a human act. A malformed `record`
   payload (non-numeric `id`, non-string `name`) goes straight into `reads` and `host.read`. The
   spec says a page reads and acts only as its own extension. `navigate` should be limited to the
   page's own repository and extension, and the payload fields should be checked.

5. `app/ui/text/unsaved.ts:79`: Every keystroke writes the device store twice, and the `unsaved` key
   list is a read-modify-write that races across concurrent `Storage.setItem` promises.

   Failure scenario: `writeUnsaved` calls `device.set` for the entry and then for the whole
   `unsaved` list, and each call does `JSON.stringify` and an async storage write with no ordering
   between writes to the same key. Fast typing in two fields (a round's comments, a review) can
   settle the list writes out of order. A key then goes missing from `unsaved`, `pruneUnsaved` and
   the start-up restore never find that entry, and the text is lost across a restart. `dropUnsaved`
   has the same shape. Writes should be serialised per key, or the list derived from the entries.

6. `app/screens/round/saves.ts:82`: The `all` map of round queues is never cleared.

   Failure scenario: `savesOf` caches each round's `Saves` (closures over `file()`, plus the
   `written` and `queued` maps) for the life of the app so no save is lost. Nothing ever removes an
   entry when a round settles or its repository leaves the list. A long-running app that works
   through many rounds, or removes and re-adds repositories, keeps all of them and their last file
   snapshots. A later round that reuses an id also inherits stale `hash` and `written` state until
   the next read.

7. `crates/server/src/preview/proxy.rs:96`: Any frame request for a base whose preview is not
   running calls `previews.wake`, which re-reads the story and preview records and so starts the
   preview.

   Failure scenario: A preview the human stopped deliberately, or one that fell out of the runner
   after repository removal or a code move, is hit by a stale open iframe or a prefetch with the
   still-valid frame secret. `state.is_none()` is true, so `wake` marks `Preview` and `Story`
   changed. Any client still holding those records re-reads them, which counts as a view and starts
   a Storybook or dev server nobody asked for. There is no check that the request comes from a live
   viewer. The 30-minute idle sweep then keeps cycling the preview on and off.

## Codex · GPT-6.1-Sol

The changes introduce silent overwrite and draft-loss paths, stale round writers, and lifecycle
defects. Consequential single-key actions also bypass the explicitly requested safeguard.

Full review comments:

- [P1] Save proposals against the version editing began from —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/proposal/FileEditor.tsx:36-39
  If a proposal changes on disk while its editor has unsaved text, the live record supplies the new
  hash here, but `text` still contains edits based on the old version. The server accepts the save
  and silently overwrites the external changes. `ConflictEditor.tsx` repeats this pattern with
  `read.hash`. Both editors need the original edit base and an explicit overwrite choice, as
  `FileEditor` already provides.

- [P2] Clear the New visit's pending state before navigating —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/new/NewPane.tsx:147-149
  After successfully starting a chat, navigation happens before `pending.set(false)`. Because
  `pane.remember` writes into the currently shown history entry, the reset updates the session's
  visit, leaving the original New visit permanently pending. Returning with Back and trying to send
  another chat consequently returns immediately. Reset the originating visit before navigation, or
  keep in-flight state outside visit-relative setters.

- [P2] Rebind cached round queues to the current file reader —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/round/saves.ts:83-86
  Reopening a round returns its existing queue without updating the `file` accessor captured by
  `createSaves`. After the original subscription expires, a new pane reads a new store entry while
  the queue continues using the old file's answers and hash. Subsequent edits can therefore
  repeatedly conflict despite the screen showing current data; default rounds also retain the wrong
  submission base. Preserve the queue, but update its current reader on remount.

- [P2] Confirm consequential shortcuts before executing them —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/home/ContinueAll.tsx:49-54
  Pressing `C` on Home immediately continues all eligible agents, with neither confirmation nor
  undo. The same problem exists for Jobs' `r`, Git's `P`, and the transcript's allow-and-retry keys.
  These single-key paths bypass the deliberate-action safeguard requested for this review: have them
  open a confirmation or the existing start dialog, while retaining explicit buttons for execution.

- [P2] Preserve review text typed while a save is pending —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/review/Comment.tsx:64-65
  Save with Ctrl+Enter, then continue typing before the response arrives: the field remains
  editable, but this unconditional discard deletes the newer text from both the field and device
  storage. Only the earlier snapshot reached the server. `AddNote` and `CommitBox` have the same
  post-await discard pattern. Clear only the submitted version, retaining later edits, and do not
  close a comment field that still has unsaved changes.

- [P2] Snapshot a new chat's message before asynchronous work —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/new/NewPane.tsx:138-146
  The New composer stays editable while `session.newChat` and image uploads run, but the message is
  read only afterward. Text typed after pressing Send can therefore be sent without another
  deliberate submission. Further text typed while `session.send` awaits its response is then erased
  by `draft.discard()`, although it was never sent. Capture the submitted text and attachments
  immediately and preserve subsequent draft changes.

- [P2] Restore refused messages alongside newly typed drafts —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/session/Composer.tsx:147-151
  If the owner begins another message while a send is pending and that send is refused, this
  condition skips restoring the original message. It has already been removed from device storage
  and is not in the transcript, so its text is lost. Preserve both messages, for example through the
  existing `putBack` helper or a separate recoverable failed-message draft.

- [P2] Stop submission when saving round notes fails —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/round/End.tsx:73-77
  `saveNotes` handles rejection by setting a refusal and then resolves successfully. Consequently,
  `submit` proceeds to `saves.submit` even when the notes were not saved. For example, a conflicting
  notes edit from another client can refuse this save while `answers.submit` still commits the round
  without the owner's notes. Propagate the failure or return an explicit success result and stop
  submission on refusal.

- [P2] Hold the Git record when constructing sync actions —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/git/Sync.tsx:41-44
  `page()` calls `record` afresh whenever a guard or action reads it. Keyboard dispatch evaluates
  those guards outside a reactive owner, and Pull/Push also read the branch from their event
  handler, so these holds have no cleanup. Using the shortcuts leaves `GitPage` subscribed after its
  pane closes. Acquire the record once inside `syncActions`, while its component owns the
  subscription, and let callbacks read that accessor.

- [P2] Include the refused write's repository when opening it —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/screens/shell/Writes.tsx:187-189
  The frame shows refused writes from every repository, but several producers supply
  repository-relative addresses such as `/f/<folder>/spec.md` and `/inbox/triage`. Clicking Open
  while viewing another repository lets `navigate` fill in that currently viewed repository instead
  of `props.repo`, opening the wrong feature or round. Explicitly attach the queued write's
  repository to the parsed route.

- [P2] Retain ownership of an unresponsive server child —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/app/src/server_start.rs:112-114
  If an owned server remains alive but fails the health probe, `ensure` starts another child and
  replaces its existing handle. This also happens when startup exceeds the minute timeout and Try
  again is pressed before the first child answers. Dropping `Child` does not terminate it, so the
  original server is no longer tracked and will not be stopped when the app closes. Keep waiting on
  the owned child, or explicitly stop and reap it before replacing it.
