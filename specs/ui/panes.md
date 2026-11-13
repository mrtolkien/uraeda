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
- **An arrangement** is a layout as the device keeps it for a kind of place, its panes named by
  their kinds (`DeviceKeys.layouts`): a new visit of any session opens as the last session was left.
  A kind of place is its subject's kind, the main stack's first pane as the place declares it.
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
- **Its tab keeps its title while the row has room.** The side stack takes 440 points on a wide
  window while the main one keeps 680; short of room, the tabs beside the shown one leave their
  icons out first, then the farthest shrink to their icons, their titles in their tips. A short
  title is what keeps it whole: "Figures", not "What it produced".
- **It keeps nothing in component state that matters.** A hidden tab is not drawn, and a pane moved
  to the other stack is drawn anew. Its scroll is kept by `PaneScroll`, or a `VirtualList`'s by
  `offset` and `onOffset` with `remember`; its cursor, folds, and other small values by
  `usePane().remember(name, initial)`, a cursor through `createCursor`'s `initial` and `onChange`;
  and its unsaved text in the store or the device, as any field's.
- **Its keys are its own.** Keys a view declares with `registerKey` are in the pane's scope, on
  while the pane has the focus, so two panes may both have `j`. The frame's `h` `l` `j` `k` are
  fallbacks: a pane may declare them too, for columns or rows, and return `false` at its edge so the
  focus moves on.
- **Every place is opened by a test**: a page given a place gets an address, and words its records
  draw, in `app/screens/shell/places.test.tsx`, which fails without one, and when a key of the page
  means two things.
- **A page read at a glance splits its stacks**: `definePlace(page, panes, { split: ["main"] })`
  shows all of a stack's panes at once, one under the other, until the human makes them tabs, as
  Home does. Most pages leave their stacks as tabs.
- **Its action may lead to another pane**: `focusPane(ref)` focuses it, showing it, as a list's
  Enter focuses the detail it opened in the other stack.
- **`closes`** says the human may close it. A place's subject never closes.
- **`action`** is the page's one action, as a job's "Run now": the pane draws it by its title on a
  wider window, and on a narrow one the bottom bar holds it, after the panes' tiles, where a thumb
  reaches it.
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

## What a pane must do to move

The human moves panes (below): to the other stack, as a tab of a stack it was not declared in,
zoomed to the window, closed and brought back, or opened beside a page it does not belong to. A pane
that follows these rules moves without any code of its own:

- **It reads everything from its arguments and the store, never from the route.** A pane opened
  beside is drawn on another page: `route()` there is that page's. A reader that scrolls to the
  address's `#heading` checks the address is its own file's first. A place reads the route to make
  its panes' arguments; the pane reads its arguments.
- **It keeps what a move must not lose in the visit or the device**, as above: a move draws it anew
  in the other stack. Its scroll, `PaneScroll` or a list's `offset` kept under `usePane().key`
  (`positions()`, which writes nothing a page reads); its cursor and folds, `remember`; its typed
  text, the device's `unsaved`. A zoom does not draw it again, nor a split's resize.
- **What it names can open beside it.** A list whose rows name something with a pane of its own (a
  session, a file, a diff) gives `beside={(id) => pane(...)}` to `List`, `VirtualList`, or
  `listKeys`: `shift+Enter`, a long press on the row, and "Open … beside" in the pane's menu then
  put that pane in the other stack of the page shown, as a tab, the focus on it, in place of the
  row's `Enter`, which goes to its page. Elsewhere, `besideOpener()` gives the function that does
  it. A pane kind opened beside another of its kind on the same page, as a second conversation, is a
  kind of its own with a title that tells the two apart (`session-beside`).
- **`closes: true` for every pane the place does not need**: a page's companions close, its subject
  never. A pane opened beside always closes.
- **A web view, or an extension's page, is drawn again by a move**: it reloads, keeping only what
  its address and its records hold. A zoom keeps it, as the other stack is only hidden.

## The moves

The keys are the leader's group `Space w`, "window", as LazyVim's `<leader>w` and Vim's `Ctrl-w`,
declared once in [`moveKeys.tsx`](/app/ui/layout/moveKeys.tsx), whose table the pane's menu draws
too, each entry with its key. A move that makes no sense where the focus is, or on a narrow window,
is absent from both, never disabled.

| Key           | Does                                                                            | Narrow |
| ------------- | ------------------------------------------------------------------------------- | ------ |
| `Space w H`   | The focused pane to the main stack, as i3's `move left`                         | -      |
| `Space w L`   | The focused pane to the side stack; the main stack's last pane stays            | -      |
| `Space w m`   | A side pane swaps with the pane main shows, Hyprland's `swapwithmaster`         | -      |
| `Space w <`   | The tab one place left, `>` right; on a narrow window along the one stack       | yes    |
| `Space w s`   | The focused stack split, or tabs again; `=` gives split panes equal heights     | -      |
| `Space w f`   | Fold the side stack, or unfold it, as `]`                                       | -      |
| `Space w z`   | Zoom the focused pane over both stacks' room, and back, as Zed's and tmux's     | -      |
| `Space w o`   | One stack: the side stack's panes join main as tabs, as Vim's `:only`; and back | -      |
| `Space w q`   | Close the focused pane, if it closes; `u` brings the last closed back           | yes    |
| `Space w r`   | Reset this kind of place's arrangement; `R` every kind's                        | yes    |
| `Shift+Enter` | On a row that names a pane: open it beside                                      | yes    |

The pointer does the same: the `…` at the end of a pane's title opens its menu, and so does a long
press on its tab, the touch's way; a tab dragged onto the other stack moves there, both stacks lit
as targets while it is carried; the line between split panes drags their heights. Every move glides
(`arrive` in [`arrival.tsx`](/app/ui/layout/arrival.tsx)): the stack a pane lands in slides in from
where it came, while the frame glides to its new sizes.

The status line names `␣w panes`; the leader menu, opened at `Space w`, teaches the rest.
