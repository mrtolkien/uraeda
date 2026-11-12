// A page of `crates/app/tests/outside.rs`: it runs, then breaks when its host asks: it throws in
// a callback, never returns from one, or takes memory without end.
import "./start";
import { host, mount, Text, View } from "nsh";

function Page() {
  return (
    <View class="flex-1 items-center justify-center bg-background">
      <Text class="text-foreground">A page that breaks when asked</Text>
    </View>
  );
}

mount(Page);
host.on("throw", () => {
  throw new Error("broken in a callback");
});
host.on("loop", () => {
  for (;;) {
    // Never ends: the engine cuts the call off.
  }
});
host.on("grow", () => {
  // Large arrays filled by the engine itself: one element at a time through a callback took
  // longer than the call's budget on a loaded machine, which cut the call off first.
  const kept: Array<Array<number>> = [];
  for (;;) {
    kept.push(new Array<number>(1 << 20).fill(kept.length));
  }
});
host.on("ping", () => host.post("alive"));
