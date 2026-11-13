// A proposal's pane over the sandbox `just app-test` starts, as `proposal.test.tsx` opens it: the
// real shell at `/r/sample/priorities/git-listener`, "Git listener process", whose file is
// `specs/proposals/git-listener.md`. Each start the app sends is posted as `starts`, and refused
// here, never sent: the shared sandbox keeps its proposal. The test sends `go` with an address,
// which the app opens as a link would. It changes the proposal's file on disk through another
// action, `write`, as an agent would, and reads what the disk holds from `disk`, posted at each
// change of the record.
import { effect, host, mount, signal } from "nsh";
import {
  call,
  connection,
  navigate,
  type Opener,
  parseRoute,
  record,
  RecordsRoot,
  redirect,
} from "../../../store";
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

const FILE = "specs/proposals/git-listener.md";
let hash = "";

host.on("write", (text) => {
  void call("text.save", { hash, path: FILE, repo: "sample", text: String(text) }).then(() =>
    host.post("written", null),
  );
});

/** Posts what the disk holds as the server says it changed. */
function Disk() {
  const file = record("ProposalFile", { id: FILE, repo: "sample" });
  effect(() => {
    const read = file();
    if (read) {
      hash = read.hash;
      host.post("disk", read.text);
    }
  });
  return null;
}

/** Whether the shell's connection is live: the disk is read from then on. */
const live = signal(false);
const look = () => (connection()?.status() === "live" ? live.set(true) : setTimeout(look, 50));

void boot().then(() => {
  redirect(parseRoute("/r/sample/priorities/git-listener"));
  mount(() => (
    <>
      <Root host={played} open={open} />
      <RecordsRoot value>
        <If when={live()}>
          <Disk />
        </If>
      </RecordsRoot>
    </>
  ));
  look();
});
