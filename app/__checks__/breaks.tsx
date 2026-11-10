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
  const kept: Array<Array<number>> = [];
  for (;;) {
    kept.push(Array.from({ length: 100_000 }, (_, index) => index));
  }
});
host.on("ping", () => host.post("alive"));
