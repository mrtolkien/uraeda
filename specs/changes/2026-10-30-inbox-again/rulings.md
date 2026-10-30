# Rulings: Run a new inbox cleanup

The low-impact choices made while sorting the inbox and making its simple fixes, inside the limits
of [the proposal](proposal.md) and the decisions. None binds future work: those are decisions.

## R1: A note is fixed here only when nothing in it is yours to choose

- **Decision**: 7 of the 16 notes are fixed on this branch and leave the inbox: two in the core,
  three in the web UI, the realistic fixture, and the README screenshots' script. The other 9 move
  to Now, in three proposal files and one line, grouped by what they touch; the SVG note among them
  is half fixed ([R3](#r3-only-an-svg-link-is-drawn-an-svg-in-a-proposal-waits)).
- **Rationale**: the proposal asks to fix what is simple and needs no decision, and to move the rest
  to Now, grouped by feature.
- **Where**: `specs/INBOX.md`, `specs/PRIORITIES.md`, `specs/proposals/`

## R2: The home columns stay centred on the screen

- **Decision**: no fix: the note goes to the Reading and layout pass.
- **Rationale**: Home's columns are centred on the whole screen, as the wide screens' guide asks,
  quoting you: "They should be center of _the whole screen_ when it's possible"
  ([wide.md](/specs/ui/wide.md#the-frame)). Centring them in the room beside the sidebar reverses
  that.
- **Where**: `packages/web/src/layout/Page.tsx`, `useScreenCentre`

## R3: Only an SVG link is drawn; an SVG in a proposal waits

- **Decision**: a link to an `.svg` file in a `mockups` folder opens through the sandboxed mockup
  route, drawn. Showing an SVG as an image in a proposal moves to Mockup previews.
- **Rationale**: the [attachments](/specs/decisions/attachments.md) decision says the core MUST
  refuse image types that can carry code, such as SVG. The mockup route already serves `.svg` under
  `sandbox allow-scripts`, as it serves an HTML mockup.
- **If wrong**: one line in `pathLink` (`packages/web/src/links.tsx`).
- **Where**: `packages/web/src/links.tsx`

## R4: The setup's message goes before a draft, not in place of it

- **Decision**: "Set up with the agent" on an open New page puts the setup's message first, then
  what was typed, once per visit.
- **Rationale**: it is how a recommended message is inserted (`withInserted`), and replacing the
  draft would lose what you typed.
- **If wrong**: Home's button always opens a fresh New page with an empty draft, so today only a
  navigation to the New page while it is open reaches the draft case. The fix costs one ref.
- **Where**: `packages/web/src/NewPage.tsx`, `useSetupMessage`

## R5: New drops its Proposal and Note items

- **Decision**: the sidebar's ＋ New and the phone's New tab open the New page; the menu is gone.
- **Rationale**: the note asks for it. A proposal stays at `Space n p` and the Priorities' ＋, a
  note at the Inbox's ＋ and the column's Note.
- **Where**: `packages/web/src/shell/ColumnPanes.tsx`, `packages/web/src/shell/Tabs.tsx`

## R6: The performance pass's mockups are not reproduced

- **Decision**: the note moves to Mockup previews, as written.
- **Rationale**: its stories existed on the branch when the spec was written, and the feature has
  merged since, its folder gone: there is no page left to reproduce it on.
- **Where**: `specs/proposals/mockup-previews/proposal.md`
