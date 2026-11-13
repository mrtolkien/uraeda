// The app's shell, as `shell.test.tsx` opens it: the real shell, over the sandbox `just app-test`
// starts (its address in `URAEDA_SANDBOX`), with a host the test plays in place of the Linux one.
// `host.params.scenario` says what the machine does:
//
// - `starts`: no server runs; the host answers `server()` once the test sends `started`. Then
//   `stops` ends the line to the server, and refuses the next ones, until `started` again.
// - `app-older` and `server-older`: the app says `hello` with a version one below or one above
//   its own, as an app or a server of another release would meet it.
// - `pairing`: the server is another machine's, and the device was never paired.
// - `revoked`: the server is the sandbox with sign-in on (`URAEDA_SANDBOX_SIGN_IN`), another
//   machine's, and the device was never paired: it pairs for real, with `POST /pair`. Then the
//   test's `revoke` pairs a second device with the access key (`URAEDA_SANDBOX_KEY`), and revokes
//   the first one from that second connection, with `devices.revoke`; the host posts `revoked`.
//   The test's engine reads no environment: the app posts it the key, as `key`.
import { host, mount } from "nsh";
import { type Opener, PROTOCOL } from "../../../store";
import { Connection } from "../../../store/connection";
import { openSocket } from "../../../store/line";
import { Root } from "../Root";
import { boot } from "../boot";
import type { ShellHost } from "../host";

const scenario = String(host.params.scenario ?? "starts");
const signed = process.env.URAEDA_SANDBOX_SIGN_IN ?? "";
const address = scenario === "revoked" ? signed : (process.env.URAEDA_SANDBOX ?? "");

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

/** Pairs a device with the sandbox with sign-in: its token and its id. */
async function paired(given: unknown): Promise<{ token: string; id: string }> {
  const answer = await fetch(`${signed}/pair`, {
    body: JSON.stringify({ ...(given as object), name: "The test's device" }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!answer.ok) throw new Error(await answer.text());
  return (await answer.json()) as { token: string; id: string };
}

/** The device's token and id, once paired, in the `revoked` scenario. */
let device: { token: string; id: string } | null = null;

if (scenario === "revoked") host.post("key", process.env.URAEDA_SANDBOX_KEY ?? "");

host.on("revoke", async () => {
  const other = await paired({ key: process.env.URAEDA_SANDBOX_KEY ?? "" });
  const conn = new Connection({ address, signIn: { by: "token", token: other.token } });
  const live = () =>
    new Promise<void>((resolve) => {
      const check = () => (conn.status() === "live" ? resolve() : setTimeout(check, 20));
      check();
    });
  await live();
  await conn.call("devices.revoke", { id: device?.id ?? "" });
  conn.close();
  host.post("revoked", null);
});

const played: ShellHost =
  scenario === "revoked"
    ? {
        forget: () => {
          device = null;
          return Promise.resolve();
        },
        pair: async (given) => {
          device = await paired(given);
          return device.token;
        },
        server: () => Promise.resolve({ address, local: false }),
        token: () => Promise.resolve(device?.token ?? null),
      }
    : {
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
