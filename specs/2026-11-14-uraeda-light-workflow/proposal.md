---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Uraeda light, step 0: the workflow

## What

Uraeda becomes a workflow, a small `ura` binary, and other people's tools: Obsidian for notes and
proposals, T3 Code for sessions and agents. This step rewrites the skill, its templates, and the
example so they define the FINAL workflow, the one that stands once steps 1 to 3 are done. The three
steps after it follow from it.

The skill stays generic: the workflow is the product, and every tool is optional. It names what a
human and an agent do with files and git alone, and says where a tool makes a step easier (a notes
app for ideas, a page to answer on, a session host), never that a step needs one. Obsidian, T3 Code,
and `ura serve` are what I use, given as examples and defaults, not as requirements.

- **Ideas, the inbox, priorities, and proposals** live in an Obsidian vault, not in git.
- **Starting a feature** is a session in a new worktree: the agent copies the proposal and its
  images into the feature's folder and commits it alone, as the first commit of the branch. No
  commit on the default branch.
- **Agents make every commit.** A human's answers to a round, and a human's review of a spec or
  plan, wait uncommitted in the worktree. The next agent step starts by committing them, unchanged,
  as a commit of their own. This only happens after a round is answered or a spec is reviewed, where
  the human's action cannot be missed. `ura` never commits, branches, or makes a worktree.
- **Discovery** writes a short file in git: the findings a question relies on, with their sources,
  and the map of the code. The long report, and notes on the apps, sources, and sites visited, go to
  the vault's wiki, linked to each other. Agents read the wiki when it helps, in every step.
- **A session host runs the agents**, T3 Code for me. An agent asks `ura` what is next and which
  model the step runs on; without `ura`, it finds the next step from the files, as today.
- **The constitution** changes where this needs it. I check it in the pull request.

## Notes

How I work on this one: the four steps run one after the other in the same worktree, in a session I
talk to. Discovery follows the skill, but questions are asked to me directly in the session, each
with a recommended answer: no clarifications file.

Decided on 2026-11-14, after three spikes (an Obsidian plugin, Plannotator, pages of our own):

- Rounds and reviews are answered in pages `ura serve` draws. Without it, a human edits the files.
- `ura` still reads git, with gix, for what changed since the last review and whether an answer is
  stale. Reading runs no hook.
- One vault for every repository: `projects/<repository>/`, and shared folders such as
  `inspiration/` and `docs/`. No backup of the vault for now.
- A spec may link the wiki and never depends on it.
- Not decided: where the model per step is configured, which steps get a fresh session, what a wiki
  note must hold, and whether `rulings.md` and the findings files slim down now or later.
- The research: `~/.local/share/uraeda/research/2026-11-14-uraeda-light/` (six reports, and the
  three spikes with their walkthroughs under `spikes/`).
