# Rulings: Redesign home, inbox, and priorities

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The pane edits the draft's whole text

- **Decision**: with C2, "Edit" on a drafted entry opens the draft's file text, as the editor page
  shows it, in the pane, under the line's field: the same field key, `${path}#editor`, so the pane
  and the page share unsaved text.
- **Rationale**: the web UI must not parse markdown ([stack](../decisions/stack.md)), so it cannot
  cut the H1 and frontmatter out of the text by itself; one editor keeps one save, conflict, and
  image path ([`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)).
- **Alternatives considered**: a core function editing only the body under the title: a new write
  path for a small gain; a second editor in the pane: a copy of the save logic.
- **If wrong**: the title line shows twice, in the line and in the text; a body-only field can
  replace the text later inside `DraftEditor`.
- **Where**: task 11.

## R2: A decision's icon is a Lucide name, with a default

- **Decision**: `icon` holds a Lucide icon name, like `git-branch`; the core checks only that the
  field is allowed, and the web UI shows a default icon for a name it does not register.
- **Rationale**: C8 asks for an optional field, easy to backfill; a list of names in the core would
  tie the file format to the web UI's icons.
- **Alternatives considered**: an emoji: no icon set to keep, but against the theme's outlines; a
  closed list checked by `ura check`: a core change at every new icon.
- **If wrong**: a typo shows the default icon silently; a check can be added from the web UI's list.
- **Where**: tasks 7 and 14.

## R3: A commit limited to its paths

- **Decision**: "Add and commit" commits with `git commit --only -- <path>`, through a new
  `Git::commit_only`, so other staged files stay staged.
- **Rationale**: the spec's edge case keeps other staged files out of the commit, while today's
  `Git::commit` refuses when any are staged ([`git/commit.rs`](/crates/core/src/git/commit.rs)).
- **Alternatives considered**: refusing, as `ura note` does today: the edge case would fail.
- **If wrong**: a hook that reads the whole index sees only the path; `ura note` keeps its refusal.
- **Where**: task 6.

## R4: "Ongoing" names the started entries' section

- **Decision**: the section above Now, holding the entries whose feature or change runs, is titled
  "Ongoing", in green.
- **Rationale**: C6 offers "Ongoing" or "Working"; "Working" is already the status of an agent's
  turn on home and in the sidebar, and a feature waiting on the human is not working.
- **Alternatives considered**: "Working", "Running" (the entries' own mark).
- **If wrong**: one string in `PrioritiesList.tsx`.
- **Where**: task 8.
