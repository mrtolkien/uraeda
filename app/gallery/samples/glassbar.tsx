// Sample 3: a glass bar over a scrolling transcript, of as many rows as its host asks for. The
// host may also leave the bar out, to measure what the bar itself costs.
import { host, List, type ListRef, View } from "nsh";
import { glass, icon, mono, pane } from "./parts";
import { BLOCKS } from "./transcript";
import type { Values } from "./values";

/** The bar that stays over the transcript: where the session is, and what its agent does. */
export function stuckBar(v: Values, testID?: string) {
  return glass(
    v,
    {
      testID,
      edge: v.role.edgeQuiet,
      shadow: v.height.raisedGlass.shadow,
      style: { position: "absolute", left: 1, right: 1, top: 0, height: 34 },
      content: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        gap: 8,
      },
    },
    <>
      {mono(v, "features » nsh-migration »", { color: v.role.text3 })}
      {mono(v, "Task 27 · Surfaces")}
      <View style={{ flex: 1 }} />
      {icon("bot", v.role.running)}
      {mono(v, "working · 02:14", { color: v.role.running })}
    </>,
  );
}

/**
 * The transcript, as a list of `rows` blocks, which starts scrolled so text is under the bar. When
 * its host says `sweep`, it scrolls by itself: 900 points a frame one way for two seconds, then
 * back, the fast scroll the spike measured.
 */
export function transcript(v: Values, rows: number) {
  const items = Array.from({ length: rows }, (_, at) => ({ id: at, kind: at % BLOCKS.length }));
  let list: ListRef | undefined;
  let offset = 150;
  setTimeout(() => list?.scrollToOffset({ offset, animated: false }), 200);
  host.on("sweep", () => {
    let frame = 0;
    offset = rows * 60;
    const step = () => {
      offset = Math.max(0, offset + (frame % 240 < 120 ? -900 : 900));
      list?.scrollToOffset({ offset, animated: false });
      frame += 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return (
    <List
      ref={(node: ListRef) => (list = node)}
      testID="transcript"
      style={{ flex: 1 }}
      each={items}
      keyExtractor={(item) => String(item.id)}
      estimatedItemSize={120}
    >
      {(item) => BLOCKS[item().kind]!(v)}
    </List>
  );
}

export function glassBar(v: Values, rows: number, bar: boolean) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 160, paddingTop: 20, paddingBottom: 28 }}>
      {pane(
        v,
        {
          title: "Session",
          more: "· nsh-migration · plan",
          icon: "chat",
          focused: true,
          running: true,
          style: { flex: 1 },
          body: { paddingTop: 11, paddingHorizontal: 0, paddingBottom: 1 },
        },
        <View style={{ flex: 1 }}>
          {transcript(v, rows)}
          {bar ? stuckBar(v, "bar") : null}
        </View>,
      )}
    </View>
  );
}
