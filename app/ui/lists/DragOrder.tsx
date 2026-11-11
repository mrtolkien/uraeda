// A short list the human puts in order: the priorities, a menu's places. A row moves three ways,
// and each says where it went, in words, under the list:
//
// - **By keys**: `m` lifts the row under the cursor; `j` `k` (or the arrows) carry it, each step
//   gliding; `Enter` drops it, `Escape` puts it back where it was.
// - **By the pointer**: its grip, at the row's start, drags it; the rows it passes make room.
// - **By touch**: a long press on the row lifts it, and the finger carries it.
//
// Its order is the screen's: `onMove(id, to)` is called once, as a row lands somewhere new, with
// its place in the new order. The list shows the new order at once, and the screen's next order
// replaces it.
import { type Accessor, announce, type JSX, signal, untracked, View } from "nsh";
import { Icon, Text } from "../controls";
import { keyScope, registerKey } from "../keys/registry";
import { tokens } from "../tokens";
import { isNarrow } from "../width";
import type { Cursor } from "./cursor";
import { glide } from "./glide";
import { listKeys } from "./keys";
import { landing, moved, wentWords } from "./order";
import { Row } from "./Row";

export type DragOrderProps = {
  cursor: Cursor;
  /** What a row is called, in the words that say where it went. */
  label: (id: string) => string;
  /** A row landed at `to`, its place in the new order. */
  onMove: (id: string, to: number) => void;
  onOpen?: (id: string) => void;
  row: (id: Accessor<string>, index: Accessor<number>) => JSX.Element;
  testID?: string;
};

/** A row carried by the pointer: where it was, where it would land, and how far it went. */
type Drag = { id: string; from: number; to: number; by: number; height: number };

export function DragOrder(props: DragOrderProps) {
  const cursor = props.cursor;
  /** The order shown while a row is carried by keys, else the screen's. */
  const carried = signal<{ id: string; from: number; order: Array<string> } | undefined>(undefined);
  const drag = signal<Drag | undefined>(undefined);
  /** A row that just landed, gliding from where the pointer left it. */
  const settling = signal<{ id: string; by: number } | undefined>(undefined);
  const said = signal("");
  /** Says it under the list, and to a screen reader. */
  const say = (words: string) => {
    said.set(words);
    announce(words);
  };
  const heights = new Map<string, number>();

  const ids = () => cursor.items().map((item) => item.id);
  const shown = () => carried()?.order ?? ids();
  const land = (id: string, from: number, to: number) => {
    const count = untracked(ids).length;
    say(
      to === from
        ? `${props.label(id)} stays at ${from + 1} of ${count}.`
        : wentWords(props.label(id), to, count),
    );
    if (to !== from) {
      props.onMove(id, to);
    }
  };

  // The keys: the list's, and while a row is carried, the carrying's, which take j and k first.
  listKeys(cursor, { onOpen: props.onOpen });
  registerKey({
    hint: "m",
    keys: "m",
    label: "move",
    run: () => {
      const id = cursor.at();
      if (id === undefined) {
        return false;
      }
      const order = untracked(ids);
      carried.set({ from: order.indexOf(id), id, order });
      say(`Moving ${props.label(id)}: j k carry it, Enter drops it, Escape puts it back.`);
      return undefined;
    },
  });
  const carrying = keyScope({ kind: "selection", name: "Move", on: () => carried() !== undefined });
  const step = (by: number) => () => {
    const now = untracked(carried);
    if (now === undefined) {
      return false;
    }
    const at = now.order.indexOf(now.id);
    const to = Math.max(0, Math.min(now.order.length - 1, at + by));
    if (to !== at) {
      glide();
      carried.set({ ...now, order: moved(now.order, now.id, to) });
    }
    return undefined;
  };
  const end = (keep: boolean) => () => {
    const now = untracked(carried);
    if (now === undefined) {
      return false;
    }
    glide();
    carried.set(undefined);
    land(now.id, now.from, keep ? now.order.indexOf(now.id) : now.from);
    return undefined;
  };
  registerKey(
    [
      { keys: "j", label: "carry down", repeat: true, run: step(1) },
      { keys: "k", label: "carry up", repeat: true, run: step(-1) },
      { keys: "ArrowDown", label: "carry down", repeat: true, run: step(1) },
      { keys: "ArrowUp", label: "carry up", repeat: true, run: step(-1) },
      { keys: "Enter", label: "drop it here", run: end(true) },
      { keys: "Escape", label: "put it back", run: end(false) },
    ],
    carrying,
  );

  // The pointer: the grip, or a long press, takes the row; the rows it passes make room.
  const take = (id: string) => {
    const order = untracked(shown);
    const from = order.indexOf(id);
    drag.set({ by: 0, from, height: heights.get(id) ?? 0, id, to: from });
    cursor.set(id);
  };
  let startY = 0;
  /** The row a long press took, which the finger then carries. */
  let armed: string | undefined;
  const follow = (y: number) => {
    const now = untracked(drag);
    if (now === undefined) {
      return;
    }
    const by = y - startY;
    const sizes = untracked(shown).map((id) => heights.get(id) ?? 0);
    drag.set({ ...now, by, to: landing(sizes, now.from, by) });
  };
  const drop = () => {
    const now = untracked(drag);
    if (now === undefined) {
      return;
    }
    const order = untracked(shown);
    const sizes = order.map((id) => heights.get(id) ?? 0);
    // Where its slot is from its first one, so it glides the rest of the way from the pointer.
    const lo = Math.min(now.from, now.to);
    const hi = Math.max(now.from, now.to);
    const slot = sizes.slice(lo + (now.to > now.from ? 1 : 0), hi + (now.to > now.from ? 1 : 0));
    const travel = slot.reduce((sum, size) => sum + size, 0) * (now.to > now.from ? 1 : -1);
    drag.set(undefined);
    armed = undefined;
    settling.set({ by: now.by - travel, id: now.id });
    requestAnimationFrame(() => settling.set(undefined));
    land(now.id, now.from, now.to);
  };
  const shift = (id: string, index: number): number => {
    const now = drag();
    if (now !== undefined) {
      if (id === now.id) {
        return now.by;
      }
      if (now.to > now.from && index > now.from && index <= now.to) {
        return -now.height;
      }
      if (now.to < now.from && index >= now.to && index < now.from) {
        return now.height;
      }
      return 0;
    }
    const landed = settling();
    return landed !== undefined && landed.id === id ? landed.by : 0;
  };
  const grabs = (id: string) => ({
    onResponderGrant: (event: { pageY: number }) => {
      startY = event.pageY;
      take(id);
      return true;
    },
    onResponderMove: (event: { pageY: number }) => follow(event.pageY),
    onResponderRelease: drop,
    onResponderTerminate: drop,
  });

  return (
    <View testID={props.testID}>
      <Each of={shown()}>
        {(id, index) => (
          <View
            onLayout={(event) => heights.set(id(), event.bounds.size.height)}
            onMoveShouldSetResponder={() => armed === id()}
            {...grabs(id())}
            style={{
              transitionDuration:
                drag() === undefined && settling() !== undefined ? 0 : tokens.motion.glide,
              transitionProperty: drag()?.id === id() ? "none" : "transform",
              translate: [0, shift(id(), index())],
              zIndex: drag()?.id === id() || carried()?.id === id() ? 1 : 0,
            }}
          >
            <Row
              lifted={drag()?.id === id() || carried()?.id === id()}
              onLongPress={() => {
                armed = id();
                take(id());
              }}
              onPoint={() => cursor.set(id())}
              onPress={() => {
                cursor.set(id());
                props.onOpen?.(id());
              }}
              selected={cursor.holds(id())}
            >
              <View
                accessibilityLabel={`Move ${props.label(id())}`}
                onStartShouldSetResponder={() => true}
                {...grabs(id())}
                style={{ alignItems: "center", marginLeft: -4, width: isNarrow() ? 28 : 16 }}
              >
                <Icon name="grip-vertical" size={14} />
              </View>
              {props.row(id, index)}
            </Row>
          </View>
        )}
      </Each>
      <If when={said() !== ""}>
        <View style={{ minHeight: tokens.space.row, paddingHorizontal: 8, paddingTop: 4 }}>
          <Text testID="drag-said" tone="faint">
            {said()}
          </Text>
        </View>
      </If>
    </View>
  );
}
