// Run by `nsh test`, without a display: a round's queue of saves, kept for the run of the app so no
// save is lost with its pane, against a server played here, which keeps each call it gets. What
// using a round would show only on a bad day: a round opened again saves over the file it reads
// now, and the next round of the same name, as every inbox triage is, starts from nothing.
import { effect, signal } from "nsh";
import { expect, test } from "nsh/test";
import { connect, type Opener } from "../../store";
import type { FileView, QuestionItem } from "../../store/protocol";
import { type Saves, savesOf } from "./saves";

type Input = { base?: string; letters?: Array<string>; previous?: string };
type Call = { action: string; input: Input };

/** A server that welcomes, and answers each save with the hash after it. */
function played() {
  const calls: Array<Call> = [];
  const open: Opener = (_url, heard) => {
    setTimeout(() => heard.opened(), 0);
    return {
      close: () => undefined,
      send(text) {
        const message = JSON.parse(text) as {
          action: string;
          id: number;
          input: Input;
          type: string;
        };
        if (message.type === "hello") {
          heard.message(JSON.stringify({ epoch: "1", timeZone: "UTC", type: "welcome" }));
        }
        if (message.type !== "call") return;
        calls.push({ action: message.action, input: message.input });
        const output = {
          answer: message.input.letters?.join(", ") ?? "",
          hash: `after-${calls.length}`,
        };
        heard.message(JSON.stringify({ id: message.id, output, type: "result" }));
      },
    };
  };
  return { calls, open };
}

/** A round's file as its record reads it: its hash, its one question's answer, and its status. */
const file = (hash: string, answer: string, status = "awaiting-human") =>
  ({
    current: {
      document: { hash },
      items: {
        clarifications: {
          notes: "",
          questions: [{ answer, comment: "", id: "Q1", letters: [] }],
          settledPoints: [],
        },
      },
    },
    path: "specs/INBOX-TRIAGE.md",
    status,
  }) as unknown as FileView;

const Q1 = { id: "Q1" } as QuestionItem;
const tick = () => new Promise<void>((done) => setTimeout(done, 20));

test("a round opened again saves over the file it reads now, and the next round of its name starts from nothing", async () => {
  const server = played();
  const line = connect({
    address: "http://127.0.0.1:1",
    open: server.open,
    signIn: { by: "cookie" },
  });
  while (line.status() !== "live") {
    // oxlint-disable-next-line no-await-in-loop
    await tick();
  }
  const args = { id: "inbox-triage", repo: "sample" };
  // The round's pane, drawn with the file it reads, or not drawn.
  const shown = signal<(() => FileView) | null>(null);
  let saves: Saves | undefined;
  effect(() => {
    const read = shown();
    saves = read === null ? undefined : savesOf(args, read);
  });
  const draw = async (read: (() => FileView) | null) => {
    shown.set(read);
    await tick();
  };

  // Opened, answered, and the record shows the answer.
  const first = signal(file("one", ""));
  await draw(first);
  await saves?.answer(Q1, { comment: "", letters: ["A"] });
  first.set(file("after-1", "A"));
  saves?.read(first());
  expect(server.calls.at(-1)?.input).toMatchObject({ base: "one", previous: "" });

  // Closed; another device answers B meanwhile; opened again, on the record as it is now.
  await draw(null);
  const second = signal(file("elsewhere", "B"));
  await draw(second);
  await saves?.answer(Q1, { comment: "", letters: ["C"] });
  expect(server.calls.at(-1)?.input).toMatchObject({ base: "elsewhere", previous: "B" });

  // Submitted before the record showed that answer, and closed: the round is settled.
  second.set(file("after-2", "C", "answered"));
  await draw(null);

  // The next triage has the same name: it starts from its own file, not from what the last wrote.
  const next = signal(file("new-round", ""));
  await draw(next);
  await saves?.answer(Q1, { comment: "", letters: ["A"] });
  expect(server.calls.at(-1)?.input).toMatchObject({ base: "new-round", previous: "" });
  line.close();
});
