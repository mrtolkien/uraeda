// The app's shell, as `shell.test.tsx` opens it: the real shell, over the sandbox `just app-test`
// starts (its address in `URAEDA_SANDBOX`), with a host the test plays in place of the Linux one.
// `host.params.scenario` says what the machine does:
//
// - `starts`: no server runs; the host answers `server()` once the test sends `started`. Then
//   `stops` ends the line to the server, and refuses the next ones, until `started` again.
// - `app-older` and `server-older`: the app says `hello` with a version one below or one above
//   its own, as an app or a server of another release would meet it.
// - `pairing`: the server is another machine's, and the device was never paired.
import { host, mount } from "nsh";
import { type Opener, PROTOCOL } from "../../../store";
import { openSocket } from "../../../store/line";
import { Root } from "../Root";
import { boot } from "../boot";
import type { ShellHost } from "../host";

const address = process.env.URAEDA_SANDBOX ?? "";
const scenario = String(host.params.scenario ?? "starts");

/** Whether a server runs on the machine the test plays. */
let running = scenario !== "starts";
const waiting: Array<() => void> = [];
host.on("started", () => {
  running = true;
  for (const answer of waiting.splice(0)) answer();
});
host.on("stops", () => {
  running = false;
  for (const close of lines) close();
});

const lines = new Set<() => void>();

/** The platform's socket, ended when the server stops, and never opened while it is stopped. */
const open: Opener = (url, heard) => {
  if (!running) {
    setTimeout(() => heard.closed(), 0);
    return { close() {}, send() {} };
  }
  const shift = scenario === "app-older" ? -1 : scenario === "server-older" ? 1 : 0;
  const line = openSocket(url, heard);
  const close = () => line.close();
  lines.add(close);
  return {
    close() {
      lines.delete(close);
      line.close();
    },
    send(text: string) {
      const message = JSON.parse(text) as { type: string; protocol?: number };
      if (message.type === "hello" && shift !== 0) {
        line.send(JSON.stringify({ ...message, protocol: PROTOCOL + shift }));
        return;
      }
      line.send(text);
    },
  };
};

const played: ShellHost = {
  forget: () => Promise.resolve(),
  pair: () => Promise.resolve("sandbox"),
  server: () =>
    new Promise((resolve) => {
      const answer = () => resolve({ address, local: scenario !== "pairing" });
      if (running) answer();
      else waiting.push(answer);
    }),
  token: () => Promise.resolve(scenario === "pairing" ? null : "sandbox"),
};

void boot().then(() => mount(() => <Root host={played} open={open} />));
