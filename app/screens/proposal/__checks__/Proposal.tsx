// A proposal's pane over the sandbox `just app-test` starts, as `proposal.test.tsx` opens it: the
// real shell at `/r/sample/priorities/git-listener`, "Git listener process", whose file is
// `specs/proposals/git-listener.md`. Each start the app sends is posted as `starts`, and refused
// here, never sent: the shared sandbox keeps its proposal. The test sends `go` with an address,
// which the app opens as a link would.
import { host, mount } from "nsh";
import { navigate, type Opener, parseRoute, redirect } from "../../../store";
import { openSocket } from "../../../store/line";
import { boot } from "../../shell/boot";
import type { ShellHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const address = process.env.URAEDA_SANDBOX ?? "";
const STARTS = new Set([
  "feature.start",
  "change.startProposal",
  "feature.startText",
  "change.start",
]);
const starts: unknown[] = [];

const open: Opener = (url, heard) => {
  const line = openSocket(url, heard);
  return {
    close: () => line.close(),
    send(text: string) {
      const message = JSON.parse(text) as {
        type: string;
        id: number;
        action?: string;
        input?: object;
      };
      if (message.type === "call" && STARTS.has(message.action ?? "")) {
        starts.push({ action: message.action, ...message.input });
        host.post("starts", starts);
        const refused = {
          code: "refused",
          id: message.id,
          message: "Not started: this is a check.",
          type: "error",
        };
        setTimeout(() => heard.message(JSON.stringify(refused)), 0);
        return;
      }
      line.send(text);
    },
  };
};

const played: ShellHost = {
  forget: () => Promise.resolve(),
  pair: () => Promise.resolve("sandbox"),
  server: () => Promise.resolve({ address, local: true }),
  token: () => Promise.resolve("sandbox"),
};

host.on("go", (to) => navigate(parseRoute(String(to))));

void boot().then(() => {
  redirect(parseRoute("/r/sample/priorities/git-listener"));
  mount(() => <Root host={played} open={open} />);
});
