---
reviewed: branch
commits: 4d65eb30ffa0fe0d0c11b47ebb74b3f7e5c37e48..7f30e4efcdb79e934a4ecc211712bd47f200a5ca
---

# Findings: nsh-migration, the branch

## Claude Code · Opus 5.5

I reviewed phase 0 and found 9 issues worth reporting. I did not re-check them with a separate
verify pass. Three could cost the owner data or let an extension's code act as a signed-in client:

- **Session import over a running server**: `ura import-sessions --replace` can corrupt the store of
  a server that is running.
- **Deferred commits**: they land outside the write queue's turn, so a commit's hooks can run while
  a save writes the same checkout.
- **Extension routes**: they hand the owner's session cookie and device token to the extension's
  code.

The live engine, sign-in, the frame secret, the extension VM's limits and panics, and page signing
held up on the paths I traced.

9 findings, most severe first:

1. `crates/server/src/runner/import.rs:156`: `ura import-sessions --replace` empties and refills
   `sessions.sqlite` (keeping the old ids) even while a Rust server runs on the same data folder,
   and nothing checks for one. The store's own comment expects a server may be running during an
   import.

   Failure scenario: A server is running a turn (say turn 42) and streaming events into the store.
   The owner runs `ura import-sessions --replace`. `emptied` deletes every session, turn and event,
   then imports the Node server's turns under their old ids, which can include 42. The running agent
   keeps writing events for turn 42 into an imported turn's log, or fails on the foreign key. The
   server's in-memory state no longer matches the store, and deleting `job_runs` lets the scheduler
   start a time it already ran. Fix: refuse when `status::read(data_dir)` finds a running server, as
   `pairing_code` already does.

2. `crates/server/src/records/writing/queue/repository.rs:245`: Deferred commits (`Work::Deferred`)
   land on the queue's thread without taking the turn, so `api::land`'s git commit and hooks run at
   the same time as a `write()` that holds the turn and writes files in the same main checkout.

   Failure scenario: A `text.commit` defers a commit, then a save of another file
   (`Write::saving()`, no keys) takes the turn at once. The deferred commit's pre-commit hook
   (lint-staged style: `git stash --keep-index`, format, `stash pop`) runs while the save writes its
   file. The saved text can be stashed away and lost, or swept into the earlier commit under its
   subject, or the pop conflicts and the commit is refused for no fault of the owner's. Writes
   running 'one at a time' does not hold between landings and turns.

3. `crates/server/src/extensions/routes.rs:88`: Extension routes pass every request header to the
   extension's VM, including `Cookie` (the session cookie) and
   `Authorization: Bearer <device token>`. They also copy any response header the extension returns,
   `Set-Cookie` included.

   Failure scenario: The owner's browser or app loads `/r/repo/x/wiki/...`. The extension's code
   receives the raw `uraeda` / `__Host-uraeda` cookie or the device's 30-day token in
   `request.headers`, can keep it or `fetch` it elsewhere, and can then call any action as that
   client (revoke devices, act on every repository). This goes beyond the extension's own API, and
   the page side forbids it ('a page can read and act only as its own extension'). By answering with
   `Set-Cookie: uraeda=...` it can also fix or clear the owner's session. Fix: strip `cookie` and
   `authorization` going in, and `set-cookie` coming out.

4. `crates/server/src/records/writing/queue.rs:353`: `Queues::close` empties the map at shutdown,
   but `write`/`land` still call `Queues::open`, which makes a new queue for a write that arrives
   after the stop began. That queue turns commit deferral back on and starts a landing thread that
   nothing closes or joins.

   Failure scenario: An action still running when `on_stop("write queues")` finishes calls
   `write()`. A new queue opens, `api::defer_commits(path, true)` is set again, and the commit is
   deferred to a detached thread. The process then exits mid-commit or before it lands: files stay
   written but uncommitted, or `.git/index.lock` is left behind. The next start then reports a
   locked repository.

5. `crates/server/src/extensions/routes.rs:57`: `in_repository` finds the extension's path with the
   first `/x/` in the whole request path, so it cuts in the wrong place when the repository itself
   is named `x`.

   Failure scenario: A repository listed as `x`: a request to `/r/x/x/wiki/notes` gives the
   extension the path `/x/x/wiki/notes` instead of `/x/wiki/notes`. The extension finds no route and
   every route of every extension in that repository answers 404. Fix: cut after `/r/<name>`, using
   the matched `name`.

6. `crates/server/src/runner/import.rs:146`: `copy_images` copies files into the new data folder
   from inside the import's transaction, so the module's 'all or nothing' promise does not hold for
   the images.

   Failure scenario: Images are copied, then `copy_job_runs` or the commit fails (old store busy
   past 5 s, a constraint). The transaction rolls back and nothing is imported, but the copied
   images stay in the new `chat-images` folder. A retry skips them because `target.exists()`, and
   the reported image count no longer matches what the import did.

7. `crates/server/src/runner/store.rs:110`: Every read and every write of `sessions.sqlite` waits on
   one mutex around the single connection, which throws away the concurrent reads WAL mode gives.

   Failure scenario: With several agents streaming and writing an event per text piece, each
   transcript page read, catch-up read, or `job_recorded` check from a client or the scheduler waits
   behind those writes. A busy store makes every screen's read slower as sessions are added. A
   separate read-only connection, or a small pool, would let reads go on beside the writer.

8. `crates/server/src/runner/schema.rs:154`: `steps_taken` is a special case for stores written
   while two parallel tasks each numbered their schema step 3. It keeps a compatibility path for a
   schema that never shipped.

   Failure scenario: Every future schema step has to reason about the special case for
   `user_version == 3`, and `JOB_RUNS` needs `IF NOT EXISTS` only because of it. The project rules
   out upgrade paths at this stage ('break compatibility freely'). The shim is a merge stand-in left
   after the waves were joined; it should go, with the dev stores rebuilt.

9. `app/store/device.ts:108`: `set` records success or failure of each storage write when its
   promise settles, not in the order the writes were made, so an older failed write can mark the
   device full after a newer write of the same key succeeded.

   Failure scenario: A draft is typed past the 5 MB limit (setItem A rejects), then trimmed (setItem
   B resolves). If B settles before A, `wrote(key, true)` then `wrote(key, false)` runs: `refused`
   keeps the key and `full()` stays true. The app keeps warning that unsaved text will be lost when
   the value was in fact kept. Fix: tag each write with a counter and ignore the settling of any
   write older than the latest.

## Codex · GPT-6.1-Sol

The changes contain stored-data safety, extension isolation and lifecycle, concurrency, and
shared-control defects. Targeted tests could not run because Nix attempted to write to a cache
outside the permitted filesystem.

Full review comments:

- [P1] Refuse replacement imports while the target server is running —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/cli/src/import_sessions.rs:27-29
  Running `import-sessions --replace` against an active Rust server deletes and replaces its
  sessions and turns without stopping its processes, timers, or in-memory runner state. Subsequent
  events can fail against deleted turns or, when imported turn IDs coincide, enter an unrelated
  imported transcript. SQLite transactions do not protect that in-memory state. Require exclusive
  ownership of the destination data folder before replacing its store.

- [P1] Bound file reads outside the extension VM's allocator —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/server/src/extensions/fs.rs:98-100
  An extension calling `readText` or `readBytes` on a sufficiently large regular file allocates the
  entire file in Rust before QuickJS's 256 MiB limit applies. Encoding and serializing the result
  creates additional copies. An accidental large-file read can therefore exhaust the server's memory
  and terminate every extension and session; neither the interrupt handler nor panic recovery
  prevents allocator aborts. Enforce a bounded read before allocating the result.

- [P2] Hold the feature's idle reservation through its write —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/server/src/records/writing/queue.rs:228-232
  The working-agent check happens before `queue.turn`, which can wait behind another repository
  write. During that wait, another client can start the feature's agent: `session.send` waits for
  pending commits, not this waiting save. The save then proceeds against files belonging to an
  active run without checking again. Acquire an idle reservation coordinated with session starts
  when the write actually executes, and retain it through the write.

- [P2] Keep host call IDs unique across page reloads —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/app/src/extension_view/channel.rs:92-97
  Reloading a page resets `next_call` to zero, but asynchronous `extensions.act` responses from the
  previous page can still arrive through `pageChannel`. If the new page has already issued the same
  numbered call, `reply` removes and resolves the new page's pending reply with the old call's
  result. Preserve a monotonically increasing call counter across loads, or attach and check a load
  generation on every reply.

- [P2] Discard page fetches after their component is disposed —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/app/src/extension_view.rs:114-120
  If the user leaves an extension pane while its HTTP fetch is pending, this future retains `Shown`
  after `ExtensionView::drop` stops the view. When the fetch finishes, it unconditionally calls
  `shown.run`, loading and executing the page again after its component was removed. Track disposal
  or cancel the load, and check it before running the fetched package or emitting its events.

- [P2] Allow the composer to send attachment-only messages —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/text/Composer.tsx:53-56
  With images attached and no accompanying text, both this guard and the Send button reject sending.
  The server explicitly supports image-only messages in `runner::send::check_send`, but the shared
  composer offers no way for a session screen to enable them. Expose attachment-aware send
  eligibility, rather than treating nonblank text as the only valid message.

- [P2] Update the remembered cursor position on direct selection —
  /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/lists/cursor.ts:78-84
  Selecting a row with the pointer calls `cursor.set`, but `put` never updates `place`. The
  reconciliation effect tracks only `items()` because it reads `at` untracked, so selecting a
  distant row leaves the remembered index unchanged. If that row is removed before another keyboard
  move or list update, selection jumps to the old index, often the first row, instead of its
  neighbour. Update the remembered position when setting a valid row.
