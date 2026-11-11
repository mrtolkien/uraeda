// The list of 20,000 rows filling the window, for its frames: when its host says `sweep`, it
// scrolls by itself, 900 points a frame one way for two seconds, then back, the fast scroll the
// samples measured under the glass bar.
import { host, View } from "nsh";
import { manyRow, MANY } from "./rows";
import { createCursor, VirtualList, type VirtualListRef } from "../../ui/lists";

export function scroll() {
  const cursor = createCursor(() => MANY, { initial: "2" });
  let list: VirtualListRef | undefined;
  host.on("sweep", () => {
    let frame = 0;
    let offset = MANY.length * 14;
    const step = () => {
      offset = Math.max(0, offset + (frame % 240 < 120 ? -900 : 900));
      list?.scrollTo(offset);
      frame += 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return (
    <View style={{ flex: 1, padding: 8 }}>
      <VirtualList
        cursor={cursor}
        ref={(made) => (list = made)}
        row={manyRow}
        rules
        testID="many"
      />
    </View>
  );
}
