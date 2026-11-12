---
reviewed: branch
commits: 2ebbc5e387ff11f4af86c131d8cc26800a813af4..9c843fe5106146ec280f6fbd9cb7452edfc21ad7
---

# Findings: nsh-migration, the branch

## Claude Code · Opus 5.5

The review found two things that should stop the merge, both about authorship and committed content, and no defect in the security-critical server code (sign-in, routes, secrets, file access, child processes). The rest are a protocol compatibility gap and small cleanups. Nothing was run; this is from reading the code and git history.

6 findings, most severe first:

1. `AGENTS.md:243`: Four commits on the branch end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`: b1b3c7a2, 1f0f2db1, d0d93754 and 04118a98. AGENTS.md forbids this: "Never mention a coding agent, a model, or an AI tool as an author or a tool used: not in commit messages (no `Co-Authored-By` lines...)".

   Failure scenario: Merged as is, main's history permanently names an AI tool as co-author, breaking the repository's Authorship rule. Smallest fix: before merging, reword those four commits to drop the trailer (for example with `git filter-repo --message-callback` or `git rebase` plus `reword`), or squash-merge.

2. `specs/2026-11-10-nsh-migration/findings-01.md:8`: The three committed findings files have headings naming coding agents and models (`## Claude Code · Opus 5.5`, `## Codex · GPT-6.1-Sol`). They also hold absolute paths from this machine (`/home/tolki/Development/ai/uraeda/.worktrees/...`; for example findings-01.md:127, findings-02.md:89).

   Failure scenario: Merging puts AI tool names into a tracked file, against the AGENTS.md rule ("not in any file"). It also commits the owner's home folder and worktree layout, which the brief lists as something never to commit. Smallest fix: rename the headings to neutral reviewer labels ("Review A", "Review B") and rewrite the paths relative to the repository (`crates/cli/src/import_sessions.rs:27-29`).

3. `crates/protocol/src/message.rs:13`: Commit 651bb2bd added new enum values (`continue` to `StatusReason` and `NeedsYouReason`) without raising `PROTOCOL` from 2. An older app indexes `REASONS[row.reason]` and reads `.icon` from the result (app/screens/home/core.tsx:36-38), so it throws on a value it does not know.

   Failure scenario: A Linux app from before this commit connects to a newer `ura serve` (both say protocol 2, so the handshake passes). Any feature of Now waiting for Continue makes NeedsYouList send `reason: "continue"`. `look` is undefined, `look.icon` throws while Home draws, and Home shows an error page instead of saying which side to update. The protocol decision says a change older clients cannot read raises the version. Smallest fix: raise `PROTOCOL` to 3, or have the client fall back for an unknown reason (`REASONS[row.reason] ?? REASONS.step`).

4. `crates/server/src/records/workspace/status.rs:36`: `in_now` calls `api::read_workspace(root)` again for every Feature record it computes, only to learn whether one folder is in Now, although the caller already holds the feature.

   Failure scenario: Each recompute of a Feature record (every file change, every turn end, for each subscribed feature page) now reads the whole workspace (all features, all priorities) a second time. Smallest fix: read the priorities once in `feature.rs::record` and pass `now_of(&priorities).contains(folder)`, or ask the core for the one proposal line.

5. `app/screens/session/SessionsPage.tsx:160`: Every SessionCard now starts its own 30 s `ticking` timer, but only a working card uses it.

   Failure scenario: A sessions list showing 20 to 40 idle or archived cards runs that many timers, each re-evaluating its card's `time` every 30 s for nothing. Smallest fix: create the ticker only for working cards, or share one ticker for the page (as Home's `InProgress` does).

6. `.gitignore:1`: The worktree has an untracked `node_modules/` (vite-plus, vitest, eslint plugins) and a stand-in `vite.config.ts` at the root, and `.gitignore` no longer ignores either.

   Failure scenario: One `git add -A` or `git commit -a` from the worktree root commits the old Node stack's packages and a Vite config into a branch whose goal is to remove them, and the `just ready` check that the tree is unchanged would not catch it. Smallest fix: delete both from the worktree (they are local leftovers), or add `node_modules/` and `/vite.config.ts` to `.gitignore` until every checkout is migrated.

What I checked and found sound:
- **Sign-in**: one check function with one list of open routes (`check.rs`); unlisted routes answer 401. Host-only routes ask for the host token again in the handler. Keys, sessions, device tokens, pairing codes and one-time links are stored only as SHA-256 hashes and compared in constant time. A failed sign-in or pairing logs where it came from, never what was tried. The status file and `sign-in.json` are written owner-only (0600 file, 0700 folder).
- **Pairing**: 60-bit codes, uniform symbols, 10 minutes on the server's clock, used once; cookies use `Max-Age`, so the device's clock never matters.
- **Guard**: the server listens on loopback only. The guard checks the Host header (DNS rebinding) and the Origin, refuses cross-site writes, never lets `<ext>.localhost` upgrade to a WebSocket, and only lets `Origin: null` frames read paths with the frame secret.
- **Redirects**: one-time links redirect only to paths on the server (no `//`, no backslash).
- **Files**: raw files and images go through the core's path containment. Chat image ids are strictly validated UUIDs. Mockups need the frame secret and are served sandboxed. Images are served with `nosniff`, CORP, and a sandboxed CSP for SVG.
- **Preview proxy and extension routes**: both strip cookies and `Authorization`, and drop `Set-Cookie` and `Clear-Site-Data` from answers (the findings-01 #3 fix held).
- **Child processes**: every one starts from `Environment::command` (environment cleared, then the config folder's `.env`). The new `process::output` puts a command in its own process group and kills the group on timeout or drop. `say!` replaced every print and cannot panic on a closed pipe.
- **Imports and data folders**: `ura import-sessions` opens the old database read-only and refuses while a server runs (the findings-01 #1 fix held). The data folder is `uraeda-next`, and the old one is only read.
- **Frames**: compressed frames check their declared size against the 16 MiB limit before inflating, and refuse a part longer or shorter than declared.
- **Status on Home**: the new "waits for your Continue" status leaves catch-up alone, and Continue all and the catcher still behave as before. The notifier skips it.
- **Release key registry**: a key that means two things still throws in development and tests, and `NODE_ENV` is set by NSH's bundler, so the non-throwing release path is reachable.
- **Follow state**: the rules in `follow.ts` are consistent with the list. The changed list test still asserts behaviour and was not weakened.
- **Test programs merged into one per crate**: every `tests/*.rs` is a module, there is a guard test for that, and the nextest groups and recipe filters were updated. `bench_` tests are only in core, cli and lsp, which were not merged.
- **Workflows and docs**: no Node, pnpm or Vite step is left in `.github/workflows`, and the dist build-setup comes from `.github/build-setup.yml`. The docs mention Node only as history or as the old way of installing.
- **Earlier findings**: the samples I checked held: extension-route credentials, import over a running server, and deferred commits in the write queue.

## Codex · GPT-6.1-Sol

Inspection found the route guards, hashed sign-in credentials, bounded extension reads, and compressed-frame ceiling sound on the paths traced.
Sampled queue-shutdown and extension-header fixes held; seven existing draft tests passed, but the additional delivery-order reproduction failed.
Node-free release wiring and test-module consolidation were inspected without another blocker; full repository checks were blocked by sandbox access to Nix.

Full review comments:

- [P1] Lock the data folder before starting another server — /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/crates/server/src/start.rs:103-112
  Two concurrent starts using the same data folder and different ports (or `--port 0`) can both pass the status-file check before either publishes its status. Both then open the same store, and the second startup's `Store::interrupted` can mark the first server's active turns stopped; their independently cached sign-in stores can also overwrite each other's changes. A failed handoff to a still-running server permits the same outcome. Acquire an exclusive data-folder lock before checking status or opening stores, and retain it until shutdown.

- [P1] Preserve pending edits when the record arrives before the result — /home/tolki/Development/ai/uraeda/.worktrees/2026-11-10-nsh-migration/app/ui/text/unsaved.ts:284-288
  The sampled phase-03 draft fix still loses text under the opposite delivery order: start with `Original`, save `Snapshot`, type back to `Original`, then receive the saved record before the action result. The draft was removed because it matched the previous saved text, and `shown()` now returns `Snapshot` because `typed.over` differs from `saved()`. Consequently this line captures `Snapshot` and silently discards the reversal. An isolated NSH reproduction fails with `expected "Snapshot" to be "Original"`; the existing test covers only result-before-record. Preserve the latest typed value independently while a save is pending, including when its record arrives first.
