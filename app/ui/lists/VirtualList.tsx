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
// - **Its scroll** is the caller's to keep, in the visit's entry: `offset` is where it opens, and
//   `onOffset` hears where it is as it scrolls. The list keeps nothing of its own.
import {
  type Accessor,
  effect,
  type JSX,
  List,
  type ListRef,
  signal,
  type StyleProp,
  untracked,
  type ViewStyle,
} from "nsh";
import type { Cursor } from "./cursor";
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

/** How near its end a list that follows must be to stay at it, in points. */
const NEAR_END = 48;

export function VirtualList(props: VirtualListProps) {
  const cursor = props.cursor;
  let list: ListRef | undefined;
  // The rows wholly shown, as the list last said: what a key's move must not scroll for.
  let shown = { first: 0, last: -1 };
  const following = signal(props.follow === true);
  const follows = (now: boolean) => {
    if (untracked(following) !== now) {
      following.set(now);
      props.onFollowing?.(now);
    }
  };

  if (props.keys !== false) {
    listKeys(cursor, {
      beside: props.beside,
      onOpen: props.onOpen,
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

  const show = (id: string) => {
    const rows = untracked(cursor.items);
    const index = rows.findIndex((row) => row.id === id);
    if (index === -1 || list === undefined || (index >= shown.first && index <= shown.last)) {
      return;
    }
    // The last row is the list's end: an index's offset is estimated for rows not drawn yet, and
    // `G` on a chat of 20,000 messages came to rest forty short of it, "Jump to the latest" shown.
    if (index === rows.length - 1) {
      list.scrollToEnd({ animated: true });
      return;
    }
    list.scrollToIndex({ animated: true, index, viewPosition: index < shown.first ? 0 : 1 });
  };
  effect(() => {
    const asked = cursor.reveal();
    if (asked !== undefined) {
      untracked(() => show(asked.id));
    }
  });

  // Rows that come while it follows: to its end, at once. A row that grows, as a reply does, is
  // Native Shell's to follow (`maintainVisibleContentPosition`).
  if (props.follow === true) {
    let count = untracked(cursor.items).length;
    effect(() => {
      const now = cursor.items().length;
      if (now > count && untracked(following)) {
        list?.scrollToEnd({ animated: false });
      }
      count = now;
    });
  }

  const pick = (id: string) => {
    cursor.set(id);
    props.onOpen?.(id);
  };
  const start = untracked(cursor.items).length;
  // A list that opens with its cursor on a row, and no place kept, opens on that row: a decision
  // opened by a link shows its card, wherever it sits in the list.
  const opened = untracked(() => {
    const id = cursor.at();
    return id === undefined ? -1 : cursor.items().findIndex((row) => row.id === id);
  });
  const firstShown =
    props.offset !== undefined
      ? undefined
      : props.follow === true
        ? start > 0
          ? start - 1
          : undefined
        : opened > 0
          ? opened
          : undefined;

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
      initialScrollIndex={firstShown}
      maintainVisibleContentPosition={
        props.follow === true ? { autoscrollToBottomThreshold: NEAR_END } : undefined
      }
      onScroll={(event) => {
        props.onOffset?.(event.offset.y);
        if (props.follow === true) {
          follows(event.offset.y + event.size.height >= event.contentSize.height - NEAR_END);
        }
      }}
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
          toEnd: () => {
            node.scrollToEnd({ animated: true });
            follows(true);
          },
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
