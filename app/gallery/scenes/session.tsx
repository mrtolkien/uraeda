// The three scenes `just frames` times, drawn as a session's transcript is: a `VirtualList` of
// 20,000 messages, each the session's own row (`screens/session/Rows.tsx`), and the reply being
// written as the last row, a growing `Reply`.
//
// - `streaming`: the reply grows by a few characters a frame, as an agent's does, and a message
//   comes every second; the list follows its end.
// - `scrolling`: the same transcript, still, scrolling by itself, 900 points a frame one way for
//   two seconds, then back: a fling far faster than a hand's, which binds every row on every frame.
// - `glass`: the same scroll under a bar of glass, a raised surface over what scrolls, as a
//   session's header once stuck.
//
// A scene feeds itself, a fixture of the same shape as the server's pages: the gallery has no
// server. The session screen feeds the same rows from the client store (`screens/session/pages.ts`).
import { cleanup, signal, View } from "nsh";
import { type Entry, type Feed } from "../../screens/session/pages";
import { type RowHands, TranscriptRow } from "../../screens/session/Rows";
import type { Item } from "../../store/protocol";
import { Icon, Kbd, Text } from "../../ui/controls";
import { createCursor, VirtualList, type VirtualListRef } from "../../ui/lists";
import { Surface } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";

export type Scene = "streaming" | "scrolling" | "glass";

/** How many messages a scene starts with. */
export const MESSAGES = 20_000;

const TOOLS = [
  ["file-text", "Read specs/2026-11-10-nsh-migration/plan.md"],
  ["pencil-line", "Edit app/gallery/Gallery.tsx"],
  ["terminal", "nix develop -c just task-app"],
  ["search", "rg -n 'definePane' app/ui"],
] as const;

const SAID = [
  "The gallery is one app now: every page is a pane of the layout shell, and the scenes are three of them.",
  "Read the plan's section on the gallery, then the rulings it names.",
  "The frames of the glass bar over the transcript stay under the budget in software, at the 99th percentile.",
] as const;

/**
 * A message of the transcript, by its number, as the server's `TurnLog` gives it: the human's,
 * the agent's words, or a tool's call, in turn. The scene draws them with the session's own rows
 * (`screens/session/Rows.tsx`), fed by this fixture in place of the client store.
 */
function itemOf(at: number): Item {
  const id = String(at);
  switch (at % 6) {
    case 0:
      return {
        at: Date.UTC(2026, 10, 12, 14, at % 60),
        id,
        images: [],
        kind: "message",
        message: id,
        opening: null,
        origin: "human",
        read: true,
        text: `${SAID[at % SAID.length]} (${at})`,
      };
    case 1:
    case 2:
      return { id, kind: "text", streaming: false, text: `${SAID[at % SAID.length]} (${at})` };
    default: {
      const [, call] = TOOLS[(at % 6) - 3]!;
      const space = call.indexOf(" ");
      return {
        call: id,
        durationMs: 1200,
        id,
        kind: "tool",
        name: call.slice(0, space),
        output: null,
        parent: null,
        status: "completed",
        subagent: null,
        target: call.slice(space + 1),
        toolKind: "execute",
      };
    }
  }
}

/** What a row of the scene stands for: an item of the fixture, or the reply being written. */
function feedOf(rows: () => ReadonlyArray<{ id: string }>, reply: () => string): Feed {
  const entries = new Map<string, Entry>();
  return {
    entry: (row) => {
      let entry = entries.get(row);
      if (entry === undefined) {
        const item: Item =
          row === REPLYING
            ? { id: row, kind: "text", streaming: true, text: "" }
            : itemOf(Number(row));
        const words = () => ("text" in item && item.text !== null ? item.text : "");
        entry = {
          item: () => item,
          kind: "item",
          text: row === REPLYING ? reply : words,
          turn: "scene",
        };
        entries.set(row, entry);
      }
      return entry;
    },
    rows,
    shown: () => {},
  };
}

/** What the rows ask of the session: a chat at rest, with nothing to allow. */
const HANDS: RowHands = {
  allowable: () => 0,
  canTakeBack: () => false,
  folder: () => null,
  kind: () => "chat",
  offerTurn: () => undefined,
  repo: "gallery",
  select: () => {},
  lit: () => false,
  selected: () => false,
  session: "scene",
  takeBack: async () => null,
  working: () => true,
};

const REPLY_SECTIONS = 20;

/** One section of the reply being written: the reply is twenty of them, about 9,000 characters. */
const section = (at: number) => `## Step ${at}

The gallery now draws every component of the library in one app, built in the layout shell, and
step ${at} checks one more of its pages against the design language, in both themes.

- Each page is a pane: its title is the tab, and the keys move between them.
- The scenes feed themselves until the client store exists.

\`\`\`ts
const frames = await measure("streaming", ${at});
\`\`\`

`;

const REPLY = Array.from({ length: REPLY_SECTIONS }, (_, at) => section(at + 1)).join("");

/**
 * The reply being written, as the session's store would hold it: it grows by a few characters a
 * frame, as an agent's does, until whole, and a message comes every second, before it.
 */
function streams(onMessage: () => void) {
  const text = signal("");
  let going = true;
  let frame = 0;
  const grow = () => {
    if (!going) return;
    frame += 1;
    text.set(REPLY.slice(0, text().length + 4));
    if (frame % 60 === 0) onMessage();
    requestAnimationFrame(grow);
  };
  requestAnimationFrame(grow);
  cleanup(() => (going = false));
  return text;
}

/** Scrolls `list` by itself, 900 points a frame, two seconds up, then two seconds down. */
function sweep(list: () => VirtualListRef | undefined) {
  let going = true;
  let frame = 0;
  let offset = MESSAGES * 30;
  const step = () => {
    if (!going) return;
    offset = Math.max(0, offset + (frame % 240 < 120 ? -900 : 900));
    list()?.scrollTo(offset);
    frame += 1;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  cleanup(() => (going = false));
}

/** The bar that stays over the transcript: where the session is, and what its agent does. */
function Bar() {
  return (
    <Surface
      glass
      height="raised"
      style={{
        alignItems: "center",
        flexDirection: "row",
        gap: 8,
        left: 0,
        paddingHorizontal: 12,
        paddingVertical: 2,
        position: "absolute",
        right: 0,
        top: 0,
      }}
      testID="bar"
    >
      <Text lines={1} style={{ flexShrink: 1 }} tone="faint">
        features » nsh-migration »
      </Text>
      <Text lines={1} style={{ flexShrink: 1 }}>
        Task 35 · The gallery
      </Text>
      <View style={{ flex: 1 }} />
      <Icon colour={tokens.light.running} name="bot" />
      <Text colour={tokens.light.running}>working · 02:14</Text>
      <Kbd keys="G" />
    </Surface>
  );
}

/** The reply's row: the transcript's last, which the list follows as it grows. */
const REPLYING = "reply";

/** One of the scenes, filling its pane. */
export function scene(name: Scene) {
  const streaming = name === "streaming";
  const messages = Array.from({ length: MESSAGES }, (_, at) => ({ id: String(at + 1) }));
  const items = signal(streaming ? [...messages, { id: REPLYING }] : messages);
  const cursor = createCursor(items, { initial: String(MESSAGES) });
  let list: VirtualListRef | undefined;
  // A message comes before the reply being written, as a tool's call does in a turn.
  const more = () => {
    const now = items();
    items.set([...now.slice(0, -1), { id: String(now.length) }, now[now.length - 1]!]);
  };
  const reply = streaming ? streams(more) : signal("");
  const feed = feedOf(items, reply);
  if (!streaming) sweep(() => list);
  return (
    <View style={{ flex: 1 }} testID={`scene-${name}`}>
      <VirtualList
        cursor={cursor}
        follow={streaming}
        framed={false}
        ref={(made) => (list = made)}
        row={(id) => <TranscriptRow feed={feed} hands={HANDS} id={id} />}
        rowHeight={30}
      />
      <If when={name === "glass"}>
        <Bar />
      </If>
    </View>
  );
}
