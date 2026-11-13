// The priorities page over the sandbox `just app-test` starts, as `priorities.test.tsx` opens it:
// the real shell at `/r/sample/priorities`, its line to the server seen by the test. Each
// `proposals.move` the app sends is posted as `moves`. With `host.params.stale`, a move is sent
// over a hash the server never wrote, as when the file changed elsewhere: the server refuses it.
import { host, mount } from "nsh";
import { type Opener, parseRoute, redirect } from "../../../store";
import { openSocket } from "../../../store/line";
import { boot } from "../../shell/boot";
import type { ShellHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const address = process.env.URAEDA_SANDBOX ?? "";
const stale = host.params.stale === true;
const moves: unknown[] = [];

const open: Opener = (url, heard) => {
  const line = openSocket(url, heard);
  return {
    close: () => line.close(),
    send(text: string) {
      const message = JSON.parse(text) as { type: string; action?: string; input?: object };
      if (message.type === "call" && message.action === "proposals.move") {
        if (stale) message.input = { ...message.input, hash: "stale" };
        moves.push(message.input);
        host.post("moves", moves);
        line.send(JSON.stringify(message));
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

void boot().then(() => {
  redirect(parseRoute("/r/sample/priorities"));
  mount(() => <Root host={played} open={open} />);
});
