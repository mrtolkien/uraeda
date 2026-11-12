// The whole app over the sandbox, as `walk.test.tsx` walks it, with the app's own capabilities (this
// folder's `nsh.json`): web views draw a mockup or a story live. `go` opens an address as a link
// would, the start of a step; a throw anywhere is drawn in its place, a finding of the walk.
import { ErrorBoundary, host, mount, Text } from "nsh";
import { boot } from "../../screens/shell/boot";
import { appHost } from "../../screens/shell/host";
import { Root } from "../../screens/shell/Root";
import { navigate, parseRoute } from "../../store";

host.on("go", (address) => navigate(parseRoute(String(address))));

void boot().then(() => {
  const shell = appHost();
  mount(() => (
    <ErrorBoundary fallback={(error) => <Text>{`problem: ${String(error)}`}</Text>}>
      <Root host={shell} />
    </ErrorBoundary>
  ));
});
