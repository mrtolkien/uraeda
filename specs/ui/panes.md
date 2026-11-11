# Panes

Every screen of the app is drawn in one frame: panes in two stacks, as a tiling window manager
arranges windows. "Our layout is very reminiscent of VSCode or other IDEs. I think we should have a
clear concept of panes, tabs, and sidebar", and "panes and tabs will look the same everywhere". A
screen says what its panes are. The layout shell, [`app/ui/layout/`](/app/ui/layout/), draws them: a
screen never draws a pane's frame, a tab bar, a side column, or the status line.

## The words

- **A pane** is a kind and its arguments, as a route is: `transcript({ session })`. Two panes of
  equal kind and arguments are one pane. A pane is a view of a thing, never the thing: it keeps
  nothing that a move would lose.
- **A stack** is an ordered list of panes, shown as tabs, one at a time, or split, all at once, one
  under the other. A stack of tabs is one pane whose title is the row of its tabs: the border goes
  around the row, and the tab shown fills with light while the stack has the focus.
- **Two stacks**: `main`, the centre, which always holds the place's subject, and `side`, at the
  right, which folds to a rail of its panes' icons. On a narrow window both are one stack: the shown
  pane fills the screen, and a bar of tiles at the foot switches between every pane.
- **The layout** is the two stacks, which pane each shows, which pane has the focus, and whether the
  side stack is folded or a pane zoomed. It is plain data in the visit (`entry().kept.layout`): Back
  returns to a page as it was left.
- **The frame** is what is not a pane: the rail of places at the left (the bar of places at the top
  on a phone), the status line at the foot, and the overlays.

## What a screen declares

A kind of pane, once, at a module's top level, with `definePane`; then the panes of each page it
draws, with `definePlace`. The first main pane is the page's subject, focused as the page opens.

```tsx
// app/screens/session/panes.tsx
import { list, record } from "../../store";
import { registerKey } from "../../ui/keys";
import { definePane, definePlace, PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Line, VirtualList } from "../../ui/lists";

// A pane's arguments are what it shows, and nothing else: the repository and the session.
type Of = { repo: string; session: string };

export const transcript = definePane<Of>({
  kind: "transcript",
  title: "Transcript",
  icon: "message-square",
  stack: "main",
  flush: true, // its rows reach the border: no padding on the sides
  mark: ({ repo, session }) => ({
    running: record("Session", { id: session, repo })()?.status === "working",
  }),
  view: (props) => <Transcript repo={props.args.repo} session={props.args.session} />,
});

export const changes = definePane<Of>({
  kind: "session-changes",
  title: "Changes",
  icon: "git-compare",
  stack: "side",
  closes: true,
  view: (props) => <Changes {...props.args} width={props.width} />,
});

// `route.repo` is optional, as an address from before repositories had names: a place with no
// repository has no panes, and the frame says so.
definePlace("session-id", (route) =>
  route.repo === undefined
    ? []
    : [
        transcript({ repo: route.repo, session: route.id }),
        changes({ repo: route.repo, session: route.id }),
        // A kind's stack can be overridden by a place: { pane: plan({ ... }), stack: "main" }.
        // A place may open on another pane than the main stack's first: { pane, focus: true }.
      ],
);

function Changes(props: Of & { width: "narrow" | "semi-wide" | "wide" }) {
  const pane = usePane();
  // Kept in the visit, under the pane's key: it survives a hidden tab, a move, and Back.
  const picked = pane.remember<string | null>("picked", null);
  // In the pane's own scope: on only while this pane has the focus.
  registerKey([
    { keys: "j", label: "Next file", run: () => next(picked, 1) },
    // At the first row, return `false`: the frame's `k` then takes the focus to the tabs.
    { keys: "k", label: "Previous file", run: () => next(picked, -1) },
  ]);
  return (
    <PaneScroll style={{ flex: 1 }}>
      <Files picked={picked()} columns={props.width === "wide" ? 2 : 1} />
    </PaneScroll>
  );
}

// A long list keeps its cursor and its scroll in the visit the same way: `VirtualList` scrolls
// itself, so its place goes through `offset` and `onOffset`, not `PaneScroll`.
function Sessions(props: { repo: string }) {
  const pane = usePane();
  const picked = pane.remember<string | null>("picked", null);
  const offset = pane.remember("offset", 0);
  const shown = list(record("SessionList", { repo: props.repo }), "rows");
  const cursor = createCursor(shown.rows, {
    initial: picked() ?? undefined,
    onChange: (id) => picked.set(id ?? null),
  });
  return (
    <VirtualList
      cursor={cursor}
      offset={offset()}
      onOffset={offset.set}
      row={(id) => <Line label={shown.item(id())?.title ?? ""} />}
    />
  );
}
```

The rules that make a pane work everywhere:

- **Its view draws only its content.** The shell draws its frame, its title and icon from `title`
  and `icon`, and its tab's mark from `mark`: a `count` after the title, `needs` in the needs-you
  colour, `running` as the stack's running line, or a small mark on its tab while it is hidden.
  `mark` may read records: it is read as a signal.
- **It draws at any width.** `props.width` is the width class of the stack it is in, not the
  window's: a side stack of 400 points is `narrow`, and so is a phone. Lay out by it.
- **It keeps nothing in component state that matters.** A hidden tab is not drawn, and a pane moved
  to the other stack is drawn anew. Its scroll is kept by `PaneScroll`, or a `VirtualList`'s by
  `offset` and `onOffset` with `remember`; its cursor, folds, and other small values by
  `usePane().remember(name, initial)`, a cursor through `createCursor`'s `initial` and `onChange`;
  and its unsaved text in the store or the device, as any field's.
- **Its keys are its own.** Keys a view declares with `registerKey` are in the pane's scope, on
  while the pane has the focus, so two panes may both have `j`. The frame's `h` `l` `j` `k` are
  fallbacks: a pane may declare them too, for columns or rows, and return `false` at its edge so the
  focus moves on.
- **A page read at a glance splits its stacks**: `definePlace(page, panes, { split: ["main"] })`
  shows all of a stack's panes at once, one under the other, until the human makes them tabs, as
  Home does. Most pages leave their stacks as tabs.
- **Its action may lead to another pane**: `focusPane(ref)` focuses it, showing it, as a list's
  Enter focuses the detail it opened in the other stack.
- **`closes`** says the human may close it. A place's subject never closes.
- **`kind` is unique** across the app: `definePane` throws on a second one. Name it after its
  screen, `session-changes`.

## The keys

| Key         | Does                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `h` `l`     | The focus to the other stack, unfolding the side one; on a phone, the previous and next pane   |
| `k`         | Past a pane's first row, its stack's tabs; in a split stack, the pane above                    |
| `j`         | In a split stack, the pane below                                                               |
| On the tabs | `h` `l` show the previous and the next tab, past the ends cross the stacks; `j` or `⏎` go back |
| `[`, `]`    | Fold the rail, and the side stack                                                              |
| `{`, `}`    | Widen and narrow the side stack, 40 points a press                                             |

The status line names `h l pane` and `[ ] fold`; the tabs' keys show beside the tabs while the focus
is there. The pointer does the same: a press in a pane focuses it, a press on a tab shows it, and
the side stack's edge drags. Its width and both folds are kept per device.

## What comes later

Task 66 adds the moves by the human: a pane sent to the other stack or swapped with the main one,
tabs reordered, a stack split, a pane zoomed or closed, a layout kept per kind of place and reset.
Their pure functions already exist in [`layout.ts`](/app/ui/layout/layout.ts): `move`, `reorder`,
`split`, `zoom`, `close`, `reset`.
