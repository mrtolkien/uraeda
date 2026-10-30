---
kind: change
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/75
---

# Record: Run a new inbox cleanup: anything that’s simple and requires no decision from me

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-30, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/75). Its full files are
> in git: `git log -- specs/changes/2026-10-30-inbox-again/`.

## What and why

The human asked for another pass over the inbox: fix every note that is simple and needs no decision
from them, and move the rest to **Now** in the priorities, grouped by feature where they are
related. Seven of the 16 notes were fixed, each in its own commit, and left the inbox. The other
nine went to **Now**: three new proposal files and one line. The inbox kept only its categories, the
two notes the human added while the change ran, and one agent's note.

## Behaviour

- **A note whose marks end its first line moves as one line**: `- [agent] [slug]` with the note's
  text on the next line now moves to the priorities, or into a proposal file, as `- <text>`. It used
  to leave a `- ` line with a trailing space and its text under it. Its text no longer starts with a
  space, and a note that is a whole link has its note file's title.
- **A start whose link rebase fails names every file**: when pointing a postponed folder's moved
  files' relative links at their new folder fails on one file, the start's partial failure lists the
  files already rebased as done, and that file and every one after it as left.
- **The closing Setup pane shows no count**: as Home's Setup pane closes, its last file written, its
  title reads "Setup", not "Setup · 0".
- **"Set up with the agent" fills an open New page too**: the setup's message goes into the
  session's composer once per visit, before any draft already there, as a recommended message is
  inserted, and not again as the cards switch. A draft used to keep the message out, so Send sent
  the draft. Home's button always opens a fresh New page, so only a navigation to an open one
  reaches the draft case.
- **The realistic project's decisions are Uraeda's own as they are now**: the sandbox's and the
  README screenshots' Decisions page shows the documentation and performance decisions, and no
  longer the UI checks and UI coherence decisions merged away.
- **The README screenshots fail when the project's turns never start**, rather than shoot Home
  without its sessions at work.
- **A link to a mockup's SVG draws it**: a link to an `.svg` file in a `mockups` folder opens
  through the mockup route, sandboxed as an HTML mockup is, rather than as its source. An SVG image
  in a proposal is still refused, as the attachments decision asks.
- **New opens the New page**: the sidebar's ＋ New and the phone's New tab are links to the New
  page, without the menu of Session, Proposal, and Note. A proposal stays at `Space n p` and the
  Priorities' ＋, a note at the Inbox's ＋ and the column's Note.
- **The inbox's notes that need the human are in Now**:
  [Reading and layout pass](/specs/changes/2026-10-30-reading-pass/proposal.md), the phone's margins
  and text size, the Replaced behaviour block, tables in reading panes, and the home columns'
  centring; [Proposal start flow](/specs/2026-10-30-proposal-start/proposal.md), its two notes;
  [Mockup previews](/specs/changes/2026-10-30-mockup-previews/proposal.md), the performance pass's
  stories that did not draw and SVG images in proposals; and the line "See if we can integrate
  Claude Design".

## Design

- **Marks alone on a note's first line**: `body` and `unmarked_lines` in
  [`files/inbox.rs`](/crates/core/src/files/inbox.rs) start the note's text on its next line when
  its marks end the first one, the root cause of both the leading space and the bare `- ` line.
- **The rebase's partial failure**: [`start/commits.rs`](/crates/core/src/actions/start/commits.rs)
  splits the moved documents at the one that failed, the ones before as done, the rest as left.
- **The Setup pane's count**: [`home/Setup.tsx`](/packages/web/src/home/Setup.tsx) gives the pane no
  count when no required file is left, which happens only as it closes.
- **The setup's message**: `useSetupMessage` in [`NewPage.tsx`](/packages/web/src/NewPage.tsx) keys
  its insertion on the history entry's id, so a visit to an already open New page inserts it, once,
  with `withInserted`.
- **The fixture**: [`fixtures/realistic/decisions/`](/fixtures/realistic/decisions/) copied again
  from `specs/decisions/`, its approver written `human`.
- **The screenshots' guard**: [`readme-screenshots.ts`](/packages/web/scripts/readme-screenshots.ts)
  throws when `serveUi`'s start callback has not run by the first page.
- **The SVG link**: `pathLink` in [`links.tsx`](/packages/web/src/links.tsx) sends `.html` and
  `.svg` files of a `mockups` folder to the mockup route, which already served `.svg` as
  `image/svg+xml` under `sandbox allow-scripts` ([`files.ts`](/packages/server/src/files.ts)).
- **New**: [`shell/ColumnPanes.tsx`](/packages/web/src/shell/ColumnPanes.tsx) and
  [`shell/Tabs.tsx`](/packages/web/src/shell/Tabs.tsx) link to `/new`; `shell/NewMenu.tsx` is gone.

## Gotchas

- **The home columns stay centred on the screen**: they are centred on the whole screen, not on the
  room beside the sidebar, as [the wide screens' guide](/specs/ui/wide.md#the-frame) asks in the
  human's words. The note asks otherwise, so it waits in the Reading and layout pass.
- **SVG images in proposals wait for a decision**: [attachments](/specs/decisions/attachments.md)
  says the core MUST refuse image types that can carry code, such as SVG, so only links were fixed.
- **The performance pass's stories were not reproduced**: they existed on its branch when its spec
  was written, and the feature has merged since, its folder gone.

## Follow-ups

- The three proposals and the line added to **Now**, above.
- An agent's note in the inbox: the leader key fixtures' spec and rounds still link the UI checks
  and UI coherence decisions, which the refreshed realistic fixture no longer has, so those links
  open a missing decision in the sandbox.
