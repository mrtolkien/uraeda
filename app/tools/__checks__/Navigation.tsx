// The whole app over the sandbox, as `navigation.test.tsx` times it: every interaction the
// development build times (`ui/timing.ts`) is written in a text no one sees, over the app, as a
// line `timed <number> <milliseconds> <to its first frame> <to its records> <what>`, the last eight
// only (a test on a display gets no post of the app's, only what it shows); `go` opens an address
// as a link would. The first is the reload: from this module's
// start, the app's first line of its own, to the frame that draws the first page with its records.
import { ErrorBoundary, host, mount, signal, Text, View } from "nsh";
import { boot } from "../../screens/shell/boot";
import { appHost } from "../../screens/shell/host";
import { Root } from "../../screens/shell/Root";
import { navigate, parseRoute, redirect } from "../../store";
import { interaction, onTimed, settledWhen } from "../../ui/timing";

/** The last few interactions timed, each with its number: the test reads those it has not seen. */
const lines = signal<ReadonlyArray<string>>([]);
let count = 0;
onTimed((timed) => {
  count += 1;
  const line = `timed ${count} ${timed.ms.toFixed(1)} ${timed.first.toFixed(1)} ${timed.settled.toFixed(1)} ${timed.what}`;
  lines.update((all) => [...all.slice(-7), line]);
});
// Nothing is drawn with its records before the store connects, which says when they came.
settledWhen(() => false);
interaction("reload");

host.on("go", (address) => navigate(parseRoute(String(address))));

void boot().then(() => {
  redirect(parseRoute("/r/sample/"));
  const shell = appHost();
  mount(() => (
    <ErrorBoundary fallback={(error) => <Text>{`problem: ${String(error)}`}</Text>}>
      <Root host={shell} />
      <View
        style={{
          height: 200,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          position: "absolute",
          top: 0,
          width: 600,
        }}
      >
        <Each of={lines()}>{(line) => <Text style={{ fontSize: 1 }}>{line()}</Text>}</Each>
      </View>
    </ErrorBoundary>
  ));
});
