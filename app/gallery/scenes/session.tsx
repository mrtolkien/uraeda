// The three scenes `just frames` times, drawn with the library as a session's transcript will be:
// a `VirtualList` of 20,000 messages, each a row of its kind, and the reply being written as a
// growing `Reply` at its end.
//
// - `streaming`: the reply grows by a few characters a frame, as an agent's does, and a message
//   comes every second; the list follows its end.
// - `scrolling`: the same transcript, still, scrolling by itself, 900 points a frame one way for
//   two seconds, then back: a fling far faster than a hand's, which binds every row on every frame.
// - `glass`: the same scroll under a bar of glass, a raised surface over what scrolls, as a
//   session's header once stuck.
//
// Until the client store exists (task 23), a scene feeds itself.
import { type Accessor, cleanup, signal, View } from "nsh";
import { Icon, Kbd, Text } from "../../ui/controls";
import { Reply } from "../../ui/document";
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

/** What a row of the transcript draws for a kind: its mark, its mark's colour, and its words. */
const KINDS = [
  { icon: "chevron-right", ink: "ink", mark: "action", tool: false },
  { icon: "circle-dot", ink: "quiet", mark: "quiet", tool: false },
  { icon: "circle-dot", ink: "quiet", mark: "quiet", tool: false },
  { icon: TOOLS[0][0], ink: "quiet", mark: "context", tool: true },
  { icon: TOOLS[1][0], ink: "quiet", mark: "context", tool: true },
  { icon: TOOLS[2][0], ink: "quiet", mark: "context", tool: true },
] as const;

/**
 * A message of the transcript, by its number: the human's, the agent's words, or a tool's call.
 * One structure for every kind, whose bindings change with it: Native Shell recycles a list's
 * cells whatever their kind, and a row that swapped its views for another kind made them again at
 * each bind, 200 views a frame while scrolling fast.
 */
function Message(props: { id: Accessor<string> }) {
  const at = () => Number(props.id());
  const kind = () => KINDS[at() % KINDS.length]!;
  const words = () =>
    kind().tool ? TOOLS[(at() % KINDS.length) - 3]![1] : `${SAID[at() % SAID.length]} (${at()})`;
  const time = () => `14:${String(Math.floor(at() / 60) % 60).padStart(2, "0")}`;
  return (
    <View
      style={{
        alignItems: "flex-start",
        flexDirection: "row",
        gap: 8,
        minHeight: tokens.space.row,
        paddingHorizontal: tokens.space.panePadding,
        paddingVertical: 2,
      }}
    >
      <Icon
        colour={
          kind().mark === "action"
            ? tokens.role.action
            : kind().mark === "context"
              ? tokens.role.context
              : tokens.role.inkFaint
        }
        name={kind().icon}
        style={{ marginTop: 4 }}
      />
      <Text
        font={kind().tool ? "code" : "body"}
        lines={kind().tool ? 1 : undefined}
        style={{ flex: 1, minWidth: 0 }}
        tone={kind().ink}
      >
        {words()}
      </Text>
      <Text size="under" tone="faint">
        {time()}
      </Text>
    </View>
  );
}

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
  if (!streaming) sweep(() => list);
  return (
    <View style={{ flex: 1 }} testID={`scene-${name}`}>
      <VirtualList
        cursor={cursor}
        follow={streaming}
        framed={false}
        ref={(made) => (list = made)}
        row={(id) => (
          <If when={id() === REPLYING} else={<Message id={id} />}>
            <View style={{ paddingHorizontal: tokens.space.panePadding, paddingVertical: 6 }}>
              <Reply align="start" text={reply} />
            </View>
          </If>
        )}
        rowHeight={30}
      />
      <If when={name === "glass"}>
        <Bar />
      </If>
    </View>
  );
}
