---
status: awaiting-human
---

# Inbox triage

> [!IMPORTANT]
>
> 3 questions on 3 notes, about 10 minutes.
>
> - The Git page's conflict markers: the only note where a user can lose work, since Continue can
>   commit a file still holding its markers. I recommend starting it as a change.
> - The two other notes are small and still true. The undo of a category's removal changes nothing
>   anyone sees: I recommend removing it. The syntax colours make Nord's comments too light: I
>   recommend a small change, while the themes are fresh.
> - All three are agents' notes, left as follow-ups by finished features: none is done already, and
>   none belongs to a proposal or an open branch.

## Context

The inbox holds 3 notes, all under Deferred fixes, all agents' notes: two have their line in
`INBOX.md`, and one is a note file alone. The other categories, Bugfix, To test, and UI, are empty.
This triage covers all 3.

For each, I read the code it is about on `main`, `PRIORITIES.md`, the proposal files, and the
records of the features that left them. I also read the open branches: the Extensions system
feature, and the `drag-handles` and `git-changes` changes. No branch touches the code of these
notes, and no commit since they were written fixes them.

## Q1: What to do with the note about conflict markers of another size

The note, from the Git page feature:

> The Git page reads conflict markers of 7 characters only: a file whose .gitattributes sets
> conflict-marker-size reads resolved at once, and Continue would commit its markers

It is still true. The page marks a conflict resolved when its file holds no line starting with
`<<<<<<< ` or `>>>>>>> `, 7 characters exactly
([`holds_markers`](/crates/core/src/git/checkout.rs)). Git writes longer markers for a file whose
[`.gitattributes` sets `conflict-marker-size`](https://git-scm.com/docs/gitattributes#_conflict_marker_size).
Such a file reads resolved as soon as the conflict starts, and Continue is enabled once every file
reads resolved ([`Conflicts.tsx`](/packages/web/src/git/Conflicts.tsx)). The editor's own conflict
reader has the same 7-character rule
([`conflicts.ts`](/packages/web/src/fields/editor/conflicts.ts)), so it would not show those blocks
either.

The fix is small: read the attribute for each conflicted file, and match markers of that length, in
the core and in the editor. The setting is rare, mostly in repositories holding text with lines of
`=======`. But when it is set, the page invites a commit of unresolved files.

Why it matters: it is the only note here where a user can lose work, by committing conflict markers
the page said were resolved.

- **A (recommended). Start it as a change: the proposal file "The Git page reads conflict markers of
  7 characters only", with the slug `marker-size`.**
  - [pro] Fixed while the Git page's code is fresh, in its own branch and pull request.
  - [con] A change runs beside the Extensions system feature, for a setting few repositories use.
  - Why recommended: the fix is small, and a page that says resolved when it is not breaks trust
    where it must be right.
- **B. A proposal in Next, "The Git page reads conflict markers of 7 characters only".**
  - [pro] Waits for a quieter moment, with the public release features.
  - [con] The bug stays in the meantime.
- **C. Keep it in the inbox.**
  - [pro] Nothing to decide now.
  - [con] The inbox stays as it is.

**Answer:**

## Q2: What to do with the note about undoing a category's removal

The note, from the master-pr feature:

> Undo of a category's removal leaves its agents' notes' lines in INBOX.md when INBOX.md had other
> uncommitted edits

It is still true, and harmless to what anyone sees: the master-pr record says the inbox shows the
same notes afterwards. The lines only turn the agents' note files into linked notes, the form any
organizing of them writes anyway. They reach a commit with the other edits. It takes three things at
once: a category holding agents' notes, removed, then undone while `INBOX.md` had other uncommitted
edits.

Why it matters: a fix costs a change for a difference in `INBOX.md`'s bytes that the inbox never
shows.

- **A (recommended). Remove it from the inbox.**
  - [pro] The inbox keeps only what a user would notice.
  - [con] The undo stays inexact in that rare case.
  - Why recommended: no user loses data, time, or trust over it.
- **B. Start it as a change: the proposal file "Undo of a category's removal leaves its agents'
  notes' lines in INBOX.md", with the slug `category-undo`.**
  - [pro] The undo puts back exactly what was there.
  - [con] A change, a branch, and a review for an invisible difference.
- **C. Keep it in the inbox.**
  - [pro] It waits for a pass on the inbox's undo, if one comes.
  - [con] It costs a read at every triage.

**Answer:**

## Q3: What to do with the note about the floor of syntax colours

The note, from the Color themes feature:

> A syntax role sharing a palette entry with ink-faint takes its stricter floor: give syntax roles
> their own floor entries (Nord's comment is lightened 29 points where 18 would do)

It is still true. A shipped theme lightens a palette colour until every role using it reaches its
contrast floor (each file's comment says so, as in [`nord.toml`](/crates/core/themes/nord.toml)).
When a syntax role and the faint text share one colour, the colour is lifted to the faint text's
floor, against the page. Code takes it too. Nord's comments end 11 points lighter than they need to
be, further from Nord's own look. Other themes may share an entry the same way; the fix gives the
syntax roles their own palette entries, lifted only to the code's floor.

Why it matters: the shipped themes are meant to look like their families, and code comments are
where a theme's look shows most.

- **A (recommended). Start it as a change: the proposal file "Give syntax roles their own floor
  entries", with the slug `syntax-floors`.**
  - [pro] Comments look like the family's again, and a test can guard each theme's lift.
  - [con] It touches every shipped theme file sharing an entry, for a shade's difference.
  - Why recommended: themes just shipped, and their fidelity was the point of the feature.
- **B. Remove it from the inbox.**
  - [pro] Nothing to do: the colours are readable, only lighter than needed.
  - [con] Nord's comments stay off.
- **C. Keep it in the inbox.**
  - [pro] It waits for the next themes pass, or the Extensions system's theme work.
  - [con] It costs a read at every triage.

**Answer:**

**Notes:**
