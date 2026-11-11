// A feature's round over the sandbox `just app-test` starts, as `round.test.tsx` opens it: the
// real shell at the sample's round `2026-10-17-round-mockup/clarifications-01.md`. Every save and
// submit the app sends is posted as `calls`; a submit is refused here, never sent, so the shared
// sandbox keeps its round waiting. With the parameter `hold`, saves are held too, never sent nor
// answered: what the round shows after a restart is then the device's alone.
import { host, mount } from "nsh";
import { navigate, type Opener, parseRoute, redirect } from "../../../store";
import { openSocket } from "../../../store/line";
import { boot } from "../../shell/boot";
import type { ShellHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const address = process.env.URAEDA_SANDBOX ?? "";
const SAVES = new Set(["answer.save", "notes.save", "settled.comment"]);
const calls: unknown[] = [];

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
      const action = message.action ?? "";
      if (message.type === "call" && (SAVES.has(action) || action === "answers.submit")) {
        calls.push({ action, ...message.input });
        host.post("calls", calls);
        if (action === "answers.submit") {
          const refused = {
            code: "refused",
            id: message.id,
            message: "this is a check.",
            type: "error",
          };
          setTimeout(() => heard.message(JSON.stringify(refused)), 0);
          return;
        }
        if (host.params.hold === "on") return;
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
  redirect(parseRoute("/r/sample/f/2026-10-17-round-mockup/clarifications-01.md"));
  mount(() => <Root host={played} open={open} />);
});
