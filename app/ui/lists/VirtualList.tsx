// A long list: Native Shell's `List`, which makes only the rows near the screen and recycles them,
// with the app's cursor, its keys, its selection, and a way to follow its end.
//
// - **Rows**: `cursor.items()` are `{ id }` objects; `row(id, index)` draws one. A cell is reused
//   for another row as the list scrolls, so `row` reads `id()` where it uses it, and reads what
//   the row shows from a signal of that id: one item's change then redraws that row alone. The
//   items' array is new at each insert, remove, or move, and keeps every other row's object as it
//   was: the list matches rows by identity (`===`), so a row keeps its cell and its size.
// - **Cursor**: the keys and the pointer share it. A key's move keeps its row in view, scrolling
//   only when the row is not wholly shown; the pointer's never scrolls. A list opened with its
//   cursor on a row, and no place kept, opens on that row; a move the screen makes with
//   `cursor.set(id, { reveal: true })`, as a link followed, brings its row into view.
// - **Follow the end**: with `follow`, a transcript opens at its end and stays there while it
//   grows, until the reader scrolls away from it; scrolled back to the end, it follows again.
//   `onFollowing` hears each change, for a "jump to the latest" button, and `toEnd()` jumps.
//   Whether it follows is the reader's to say, never read from where the list is (`follow.ts`).
// - **Its scroll** is the caller's to keep, in the visit's entry: `offset` is where it opens, and
//   `onOffset` hears where it is as it scrolls. The list keeps nothing of its own.
import {
  type Accessor,
  effect,
  type JSX,
  List,
  type ListRef,
  type StyleProp,
  untracked,
  type ViewStyle,
} from "nsh";
import type { Cursor } from "./cursor";
import { createFollow } from "./follow";
import { listKeys } from "./keys";
import { besideOpener } from "../layout/here";
import type { PaneRef } from "../layout/layout";
import { Row, rowHeight } from "./Row";

export type VirtualListRef = {
  /** Scrolls to the end and follows it again. */
  toEnd: () => void;
  /** Brings a row into view, as a key's move does. */
  show: (id: string) => void;
  /** Scrolls to a place, in points from its top: a place kept in the visit's entry. */
  scrollTo: (offset: number, animated?: boolean) => void;
};

export type VirtualListProps = {
  /** The pane a row names, opened beside the list's: `shift+Enter`, a long press, the pane's menu. */
  beside?: (id: string) => PaneRef | undefined;
  cursor: Cursor;
  /** Shown in place of the rows while there are none: an `Empty`, which says why. */
  empty?: JSX.Element;
  /** Follows its end as it grows, a transcript's way, until the reader scrolls away. */
  follow?: boolean;
  footer?: JSX.Element;
  /** Drawn in a `Row`, with its selection and its pointer: true unless the row draws its own. */
  framed?: boolean;
  header?: JSX.Element;
  /** Declares its keys in the scope around it: true unless the screen declares its own. */
  keys?: boolean;
  /** Where it opens, in points from its top: from the visit's entry. */
  offset?: number;
  /** Hears whether it follows its end now. */
  onFollowing?: (following: boolean) => void;
  /** Hears where it is as it scrolls, to keep it in the visit's entry. */
  onOffset?: (offset: number) => void;
  /** The row's own action: `Enter`, and a press. */
  onOpen?: (id: string) => void;
  /**
   * Hears which rows are wholly shown, by index, as they change: a transcript reads the pages
   * around them. `first` is -1 while none is.
   */
  onShown?: (first: number, last: number) => void;
  openLabel?: string;
  ref?: (list: VirtualListRef) => void;
  /** Draws a row's content: read `id()` where it is used, as the cell is reused. */
  row: (id: Accessor<string>, index: Accessor<number>) => JSX.Element;
  /** A row's usual height, for rows not drawn yet: a line of the grid unless given. */
  rowHeight?: number;
  /** A quiet line between rows. */
  rules?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * How far its end may move in a layout for a list that follows to follow it: any distance. The
 * reader, not a distance, says when it stops (`follow.ts`).
 */
const ANYWHERE = 1e9;

export function VirtualList(props: VirtualListProps) {
  const cursor = props.cursor;
  let list: ListRef | undefined;
  // The rows wholly shown, as the list last said: what a key's move must not scroll for.
  let shown = { first: 0, last: -1 };
  // A list that follows opens at its end, unless a place was kept or a row asked for, as a link to
  // a turn asks.
  const atEnd =
    props.follow === true && props.offset === undefined && untracked(cursor.reveal) === undefined;
  const follow = createFollow({
    atEnd,
    back: () => list?.scrollToEnd({ animated: false }),
    offset: props.offset ?? 0,
    onFollowing: (now) => props.onFollowing?.(now),
  });

  if (props.keys !== false) {
    listKeys(cursor, {
      beside: props.beside,
      onOpen: props.onOpen,
      halfPage: () => Math.floor((shown.last - shown.first + 1) / 2),
      openLabel: props.openLabel,
      start: props.follow === true ? "last" : "first",
    });
  }

  const open = besideOpener();
  /** A long press, the touch's way to a row's second action: its pane beside. */
  const besideOf = (id: string) => {
    const pane = props.beside?.(id);
    return pane === undefined ? undefined : () => open(pane);
  };

  /**
   * To the list's end, the one way there of a key and of "Jump to the latest": a jump, which lands
   * where the end is now, and following keeps it there. A way drawn toward an end that kept moving
   * came to rest short of it, and so did one from far back in a long list (ruling R425).
   */
  const toEnd = () => {
    list?.scrollToEnd({ animated: false });
    if (props.follow === true) follow.follows(true);
  };

  const show = (id: string) => {
    const rows = untracked(cursor.items);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1 || list === undefined) return;
    // The last row is the list's end, which `G` follows again wherever it is: on a chat of 20,000
    // messages a way to its index came to rest forty short, and a reply taller than the list is
    // never wholly shown.
    if (index === rows.length - 1) {
      toEnd();
      return;
    }
    // Any other row a key goes to is the reader leaving the end: the list stays with them.
    if (props.follow === true) follow.follows(false);
    if (index >= shown.first && index <= shown.last) return;
    list.scrollToIndex({ animated: true, index, viewPosition: index < shown.first ? 0 : 1 });
  };
  effect(() => {
    const asked = cursor.reveal();
    if (asked !== undefined) {
      untracked(() => show(asked.id));
    }
  });

  const pick = (id: string) => {
    cursor.set(id);
    props.onOpen?.(id);
  };
  // A list that opens with its cursor on a row, and no place kept, opens on that row: a decision
  // opened by a link shows its card, wherever it sits in the list.
  const opened = untracked(() => {
    const id = cursor.at();
    return id === undefined ? -1 : cursor.items().findIndex((row) => row.id === id);
  });
  const firstShown = props.offset !== undefined || atEnd || opened <= 0 ? undefined : opened;

  return (
    <List
      contentOffset={props.offset === undefined ? undefined : { x: 0, y: props.offset }}
      each={cursor.items()}
      empty={props.empty}
      estimatedItemSize={props.rowHeight ?? rowHeight()}
      footer={props.footer}
      header={props.header}
      // No `keyExtractor`: Native Shell reads each item's `id` itself, where a function of ours
      // ran in TSX for each of the 20,000 rows of a transcript at every row that came.
      // At its end before its first frame, and held there while its rows are measured: the last
      // row's index landed where the rows' estimated heights put it, short of the end.
      initialScrollAtEnd={atEnd}
      initialScrollIndex={firstShown}
      // Pinned to its end at every layout while it follows, rows that come and a reply that grows
      // alike, in the frame they change: a scroll of the list's own, as a row came, landed where
      // the row's estimated height put the end.
      maintainVisibleContentPosition={
        follow.pins() ? { autoscrollToBottomThreshold: ANYWHERE } : undefined
      }
      onScroll={(event) => {
        const now = event.offset.y;
        props.onOffset?.(now);
        if (props.follow === true) {
          follow.scrolled({
            content: event.contentSize.height,
            offset: now,
            size: event.size.height,
          });
        }
      }}
      onScrollDragEnd={() => follow.hand(false)}
      onScrollDragStart={() => follow.hand(true)}
      onScrollEnd={() => follow.ended()}
      onViewableItemsChange={({ viewableItems }) => {
        let first = Number.POSITIVE_INFINITY;
        let last = -1;
        for (const token of viewableItems) {
          first = Math.min(first, token.index);
          last = Math.max(last, token.index);
        }
        shown = { first, last };
        props.onShown?.(last === -1 ? -1 : first, last);
      }}
      ref={(node: ListRef) => {
        list = node;
        props.ref?.({
          scrollTo: (offset, animated = false) => node.scrollToOffset({ animated, offset }),
          show,
          toEnd,
        });
      }}
      style={[{ flex: 1 }, props.style]}
      testID={props.testID}
      viewabilityConfig={{ itemVisibleThreshold: 1 }}
    >
      {(item, index) =>
        props.framed === false ? (
          props.row(() => item().id, index)
        ) : (
          <Row
            onLongPress={besideOf(item().id)}
            onPoint={() => cursor.set(item().id)}
            onPress={() => pick(item().id)}
            rule={props.rules}
            selected={cursor.holds(item().id)}
          >
            {props.row(() => item().id, index)}
          </Row>
        )
      }
    </List>
  );
}
