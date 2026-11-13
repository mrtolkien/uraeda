# What the agents' runtimes are tested on

Recordings of the real `claude` and `codex`, each with the events the Node server's runtime made
of it. `crates/server/tests/claude.rs` and `crates/server/tests/codex.rs` play each recording to
the Rust runtime through a stand-in of the agent's command, and compare its events with those,
one by one. No test runs a real agent.

**The events are frozen.** Each `<name>.events.jsonl` was written by the Node server's own parser,
driven over the recording, never by hand: the port was checked against what it ported. That parser
went with the Node server, and the scripts that recorded and wrote these files with it. So the
events are kept as they are, as the expectation the Rust runtime was built to. A recording goes
stale with a new Claude Code or Codex: a new one is then recorded by hand, and its events are
what the Rust runtime makes of it, read before they are committed.

## `claude/`

- `<name>.jsonl`: what Claude Code 2.1.322 printed for one short message, sent as a session sends
  it, on Sonnet at a low effort, in a temporary folder outside any repository. Scrubbed: the
  session's folder reads `/session-dir`, the home folder `/home/me`, and the `init` line keeps only
  the fields a runtime reads.
- `lines/<name>.events.jsonl`: the events of `fixtures/claude/<name>.jsonl`, lines recorded from
  earlier versions of Claude Code: the usage limits, the wakeups, and a retry, which no run shows
  on demand.
- `written/<name>.jsonl`: lines written by hand for what no recording shows.
- The clock and the zone are fixed: 2026-11-10 at 09:00 UTC, when a test's server starts, in
  `Asia/Tokyo`. A stream named `<name>.at-<seconds>.jsonl` is read at that instant instead.

## `codex/`

- `<name>.jsonl`: an exchange with `codex app-server` 0.163.0, one short message in a temporary
  folder outside any repository. Its first line says how the process was opened and the message
  sent, then one line per message, `{"client": ..}` for the runtime's and `{"server": ..}` for
  Codex's. Scrubbed the same way, and the answers keep only the fields a runtime reads. The
  sandbox was read-only while recording, and reads as the `workspace-write` the runtime asks for.
- `written/approved.jsonl` and `denied.jsonl`: an action Codex's reviewer approved, whose
  notifications were recorded, and the same with the verdict changed by hand, since none was
  recorded. `written/items.jsonl` and `limits.jsonl`: notifications written by hand, in the shapes
  of Codex 0.163.0, for each kind of item, Codex's own sub-agents, the reviews' other ends, the
  usage windows, and the limits.
- The stand-in that replays an exchange is `crates/server/tests/bin/fake_codex.rs`.
