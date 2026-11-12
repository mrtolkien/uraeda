// The whole app over the sandbox `just app-test` starts, as `places.test.tsx` walks it: the test
// sends `go` with an address, and the app opens it as a link would. A throw anywhere in the frame,
// as the key registry's "A key means two things", is posted as `problem` and drawn in its place.
// At the start the app posts `places`, the pages the screens declared a place for; after each `go`,
// `shown`, the page opened and the pane it focuses. `hold` keeps what the server says until
// `release`, as a slow line does: what the human does meanwhile is done before the answer. An
// action that spends an agent's time or leaves the machine is never sent: it is posted as `called`
// and refused, so the shared sandbox stays as it is.
import { ErrorBoundary, host, mount, Text } from "nsh";
import { boot } from "../boot";
import { appHost } from "../host";
import { Root } from "../Root";
import { navigate, type Opener, parseRoute, route } from "../../../store";
import { openSocket } from "../../../store/line";
import { placedPages, placeOf } from "../../../ui/layout";

// Opens the address, then says which pane the frame focuses there, whose tab the test waits for.
host.on("go", (address) => {
  navigate(parseRoute(String(address)));
  const place = placeOf(route());
  const pane = place.focus ?? place.main[0]?.key ?? place.side[0]?.key ?? null;
  host.post("shown", { page: route().page, pane });
});

/** The actions a check never sends: each spends an agent's time, or leaves this machine. */
const NEVER_SENT = new Set(["feature.continueAll", "jobs.runNow", "git.push"]);

/** The real line, whose messages wait while the test holds them. */
let holding = false;
const waiting: Array<() => void> = [];
const line: Opener = (url, heard) => {
  const real = openSocket(url, {
    ...heard,
    message: (text) => {
      if (holding) waiting.push(() => heard.message(text));
      else heard.message(text);
    },
  });
  return {
    close: () => real.close(),
    send(text) {
      const message = JSON.parse(text) as { action?: string; id: number; type: string };
      if (message.type !== "call" || !NEVER_SENT.has(message.action ?? "")) {
        real.send(text);
        return;
      }
      host.post("called", message.action);
      const refused = {
        code: "refused",
        id: message.id,
        message: "Not done: this is a check.",
        type: "error",
      };
      setTimeout(() => heard.message(JSON.stringify(refused)), 0);
    },
  };
};
host.on("hold", () => {
  holding = true;
});
host.on("release", () => {
  holding = false;
  for (const say of waiting.splice(0)) say();
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
      <Root host={shell} open={line} />
    </ErrorBoundary>
  ));
});
