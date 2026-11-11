// The whole app over the sandbox `just app-test` starts, as `places.test.tsx` walks it: the test
// sends `go` with an address, and the app opens it as a link would. A throw anywhere in the frame,
// as the key registry's "A key means two things", is posted as `problem` and drawn in its place.
// At the start the app posts `places`, the pages the screens declared a place for; after each `go`,
// `shown`, the page opened and the pane it focuses.
import { ErrorBoundary, host, mount, Text } from "nsh";
import { boot } from "../boot";
import { appHost } from "../host";
import { Root } from "../Root";
import { navigate, parseRoute, route } from "../../../store";
import { placedPages, placeOf } from "../../../ui/layout";

// Opens the address, then says which pane the frame focuses there, whose tab the test waits for.
host.on("go", (address) => {
  navigate(parseRoute(String(address)));
  const place = placeOf(route());
  const pane = place.focus ?? place.main[0]?.key ?? place.side[0]?.key ?? null;
  host.post("shown", { page: route().page, pane });
});

void boot().then(() => {
  host.post("places", placedPages());
  const shell = appHost();
  mount(() => (
    <ErrorBoundary
      fallback={(error) => {
        host.post("problem", String(error));
        return <Text>{String(error)}</Text>;
      }}
    >
      <Root host={shell} />
    </ErrorBoundary>
  ));
});
