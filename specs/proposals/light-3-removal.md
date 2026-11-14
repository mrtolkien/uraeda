---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Uraeda light, step 3: remove what `ura` no longer does

## What

Once steps 0 to 2 have run real features, everything else goes: the server that runs and shows agent
sessions, the native and iOS apps, the protocol, extensions, the Vim layer, text editing, the
language server, and what only they use. The core shrinks to what `ura` needs: parsing, checks, the
next step, answers, reviews, a read of git, the pages, and the sync.

## Notes

- Measured: about 125k production lines and 43k test lines go; NSH, GStreamer, rolldown, three CI
  workflows, iOS sideloading, and most of CONTRIBUTING.md with them. Details in
  `~/.local/share/uraeda/research/2026-11-14-uraeda-light/report-5-surface.md` and
  `report-6-core.md`.
- About 10k lines of the core's tests rest on fixtures that go, and move.
- Before it: a last release of the full Uraeda tagged, and the server's data folder backed up.
- Not decided: what survives (the Claude accounts and usage reader, the benchmarks), whether
  Homebrew and the installer stay, and which decisions are removed or rewritten.
