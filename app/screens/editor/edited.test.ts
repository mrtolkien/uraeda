// Run by `nsh test`, without a display: "save over" a file that changed on disk is the human's
// choice for one text, never a state an ordinary save after it inherits, so an agent's change is
// never overwritten without a word.
import { signal } from "nsh";
import { expect, test } from "nsh/test";
import type { Disk } from "./disk";
import { editedFile } from "./edited";

/** A server's answer the test gives when it wants. */
function answer() {
  const hands = {} as { pass: () => void };
  const given = new Promise<void>((resolve) => {
    hands.pass = resolve;
  });
  return { given, pass: () => hands.pass() };
}

/** Lets the saves on their way run, until `done` holds, a few turns at most. */
async function turns(done: () => boolean, left = 20): Promise<void> {
  if (done() || left === 0) return;
  await Promise.resolve();
  await turns(done, left - 1);
}

/** A file on a fake disk, and what the server was asked to save, with the version it named. */
function file(key: string) {
  const read = signal<Disk>({ hash: "h0", text: "Read" });
  const sent: Array<{ hash: string; text: string }> = [];
  let held: Promise<void> = Promise.resolve();
  const edited = editedFile({
    exact: true,
    key,
    name: () => "spec.md",
    read,
    send: async (text, hash) => {
      sent.push({ hash, text });
      await held;
      return { hash: `saved-${sent.length}` };
    },
  });
  /** Waits until the server was asked `count` saves: the checks before them passed. */
  const asked = async (count: number) => {
    await turns(() => sent.length >= count);
    expect(sent.length).toBe(count);
  };
  return { asked, edited, hold: (until: Promise<void>) => (held = until), read, sent };
}

test("a save over the disk while the same text's save is on its way leaves later saves checked", async () => {
  const { asked, edited, hold, read, sent } = file("test:edited-same");
  edited.text.change("Mine");
  const server = answer();
  hold(server.given);
  // The save is on its way, its check passed; then an agent writes the file.
  const first = edited.save();
  await asked(1);
  read.set({ hash: "agent-1", text: "The agent's" });
  expect(edited.changed()).toBe(true);
  const over = edited.saveOver();
  server.pass();
  await Promise.all([first, over]);
  hold(Promise.resolve());

  // The human types; the agent writes again; the human saves: the change on disk is named, not
  // overwritten.
  edited.text.change("Mine, and more");
  read.set({ hash: "agent-2", text: "The agent's again" });
  const count = sent.length;
  expect(await edited.save()).toBe(false);
  expect(sent.length).toBe(count);
  expect(edited.saves.refusal()).toBe(
    "spec.md changed on disk: see what changed, then take a version.",
  );
});

test("a save over the disk is its own text's, never an earlier text's still waiting", async () => {
  const { asked, edited, hold, read, sent } = file("test:edited-earlier");
  edited.text.change("First");
  const server = answer();
  hold(server.given);
  const first = edited.save();
  await asked(1);
  // A second text waits behind the first; the file changes on disk; the human saves over it.
  edited.text.change("Second");
  const second = edited.save();
  read.set({ hash: "agent-1", text: "The agent's" });
  edited.text.change("Third");
  const over = edited.saveOver();
  server.pass();
  const done = await Promise.all([first, second, over]);
  // "Second" was typed over a version the agent changed: it is refused, and "Third" is saved
  // over the file as it is now.
  expect(done).toEqual([true, false, true]);
  expect(sent.map((one) => one.text)).toEqual(["First", "Third"]);
  expect(sent[1]?.hash).toBe("agent-1");
});
