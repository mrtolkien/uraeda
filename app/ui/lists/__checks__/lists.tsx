// What `lists.test.tsx` opens: one of three lists its host names, each saying on the page what a
// test reads, as a screen would keep it: where the list is scrolled, where its cursor is, whether
// it follows its end, and the order a move left.
import { host, mount, signal, Text, View } from "nsh";
import { KeysHost } from "../../keys/KeysHost";
import { KeyScope, registerKey } from "../../keys/registry";
import { createCursor, DragOrder, Line, moved, VirtualList } from "..";

/** A row of exactly 28 points, so a test can count where each one is. */
const line = (id: () => string) => (
  <View style={{ height: 28, overflow: "hidden" }}>
    <Text>{`Row ${id().slice(1)}`}</Text>
  </View>
);

const rows = (count: number, from = 0) =>
  Array.from({ length: count }, (_, at) => ({ id: `r${from + at + 1}` }));

/** A list of 2,000 rows, 400 points high: the cursor's place and the scroll's. */
function Cursor() {
  const cursor = createCursor(() => ROWS);
  const offset = signal(0);
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Text>Offset: {String(Math.round(offset()))}</Text>
      <Text>Cursor: {cursor.at() ?? "none"}</Text>
      <View style={{ height: 400 }}>
        <VirtualList
          cursor={cursor}
          onOffset={(next) => offset.set(next)}
          framed={false}
          row={line}
          rowHeight={28}
          testID="list"
        />
      </View>
    </View>
  );
}
const ROWS = rows(2000);

/** A transcript of 50 rows that follows its end; `a` adds a row. */
function Follow() {
  const items = signal(rows(50));
  const cursor = createCursor(items);
  const offset = signal(0);
  const following = signal(true);
  registerKey({
    keys: "a",
    label: "add a row",
    run: () => items.update((now) => [...now, ...rows(1, now.length)]),
  });
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Text>Offset: {String(Math.round(offset()))}</Text>
      <Text>Following: {following() ? "yes" : "no"}</Text>
      <Text>Rows: {String(items().length)}</Text>
      <View style={{ height: 400 }}>
        <VirtualList
          cursor={cursor}
          follow
          keys={false}
          onFollowing={(now) => following.set(now)}
          onOffset={(next) => offset.set(next)}
          framed={false}
          row={line}
          rowHeight={28}
          testID="list"
        />
      </View>
    </View>
  );
}

const NAMES: Record<string, string> = {
  done: "Done",
  inbox: "Inbox",
  later: "Later",
  next: "Next",
  now: "Now",
};

/** Five rows in order, moved by keys; the page says the order and how many moves landed. */
function Order() {
  const items = signal(["inbox", "now", "next", "later", "done"].map((id) => ({ id })));
  const cursor = createCursor(items);
  const moves = signal(0);
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Text>
        Order:{" "}
        {items()
          .map((item) => NAMES[item.id])
          .join(" ")}
      </Text>
      <Text>Moves: {String(moves())}</Text>
      <DragOrder
        cursor={cursor}
        label={(id) => NAMES[id] ?? id}
        onMove={(id, to) => {
          moves.update((count) => count + 1);
          const order = moved(
            items().map((item) => item.id),
            id,
            to,
          );
          items.set(order.map((one) => items().find((item) => item.id === one)!));
        }}
        row={(id) => <Line label={NAMES[id()] ?? id()} />}
        testID="order"
      />
    </View>
  );
}

const CHECKS = { cursor: Cursor, follow: Follow, order: Order };

mount(() => {
  const Check = CHECKS[String(host.params.check) as keyof typeof CHECKS] ?? Cursor;
  return (
    <KeysHost>
      <KeyScope name="Checks">
        <Check />
      </KeyScope>
    </KeysHost>
  );
});
