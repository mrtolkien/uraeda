---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Uraeda light, step 2: the vault and its sync

## What

`ura` keeps one Obsidian vault for every repository, in its own folder, and syncs it with Obsidian
on my phone. On the desktop, Obsidian opens that folder as it is.

- **Layout**: `projects/<repository>/` for each repository, and shared folders such as
  `inspiration/` and `docs/`. Every markdown file of a project's workflow shows in Obsidian: the
  constitution, the decisions, and the features in progress, through symlinks to the repository and
  its worktrees.
- **Sync**: push and pull between `ura serve` and a small Obsidian plugin, over Tailscale. Both
  versions are kept on a conflict.
- **The plugin** is in the vault, so it reaches every device with the sync.

## Notes

- The spike, with what it measured:
  `~/.local/share/uraeda/research/2026-11-14-uraeda-light/spikes/obsidian/`. Its plugin also drew
  rounds and reviews: that part is dropped, `ura serve` draws them.
- Measured: Obsidian follows a symlink to a folder (lists, watches, writes through it). A symlink to
  a single file is not watched. Links to code are dead in the vault. Each device asks once to trust
  the vault's plugin. An empty vault pulled 33 files through the tailnet.
- Not verified: anything on iOS, starting with whether Files keeps the hidden `.obsidian` folder of
  an unpacked vault.
- The spike's sync is naive: no deletions, plain file writes.
- I do not want one `inbox.md` per project piling up.
- No backup of the vault for now.
- Not decided: what the phone may write (new notes only, or edits too), what a deletion does, and
  whether proposals carry `status` and `rank` for a board.
