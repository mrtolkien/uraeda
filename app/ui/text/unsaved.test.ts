// Run by `nsh test`, without a display: what a field's unsaved text guarantees, which using the app
// shows only on the day it loses something. The app never loses a word typed: a save or a send
// takes the text as it was when the human asked, and what they typed while the server answered
// stays, whatever the answer.
import { signal, Storage } from "nsh";
import { expect, test } from "nsh/test";
import { device, deviceStore } from "../../store/device";
import { readUnsaved, restoreUnsaved, unsavedText } from "./unsaved";

/** A server's answer the test gives when it wants: `pass` or `refuse`. */
function answer() {
  const hands = {} as { pass: () => void; refuse: (error: Error) => void };
  const given = new Promise<void>((resolve, reject) => {
    hands.pass = resolve;
    hands.refuse = reject;
  });
  return { given, pass: () => hands.pass(), refuse: (error: Error) => hands.refuse(error) };
}

test("text typed while a save is on its way stays, unsaved, over what was saved", async () => {
  const saved = signal("As saved");
  const field = unsavedText("test:save", saved);
  field.change("One");
  const server = answer();
  const got: Array<string> = [];
  const save = field.save(async (text) => {
    got.push(text);
    await server.given;
  });
  expect(field.pending()).toBe(true);
  // The field stays the human's while the server answers.
  field.change("One, and two");
  server.pass();
  expect(await save).toEqual({ ok: true, value: undefined });
  // The server got what was there when the human saved, and the rest is still theirs.
  expect(got).toEqual(["One"]);
  expect(field.text()).toBe("One, and two");
  expect(field.dirty()).toBe(true);
  expect(readUnsaved("test:save")).toMatchObject({ base: "One", text: "One, and two" });

  // Saved whole, before the record says so: nothing is unsaved, and the field keeps its text.
  expect(await field.save(async () => undefined)).toEqual({ ok: true, value: undefined });
  expect(field.text()).toBe("One, and two");
  expect(field.dirty()).toBe(false);
  expect(readUnsaved("test:save")).toBe(undefined);
  expect(field.pending()).toBe(false);
});

test("text typed back to the saved text while a save is on its way stays, over what was saved", async () => {
  const saved = signal("Original");
  const field = unsavedText("test:back", saved);
  field.change("Snapshot");
  const server = answer();
  const save = field.save(async () => {
    await server.given;
  });
  // Typed back to the text saved before: no draft differs from it while the save is on its way.
  field.change("Original");
  server.pass();
  expect(await save).toEqual({ ok: true, value: undefined });
  // The server holds "Snapshot", and the field still shows what was typed after, unsaved over it.
  expect(field.text()).toBe("Original");
  expect(field.dirty()).toBe(true);
  expect(readUnsaved("test:back")).toMatchObject({ base: "Snapshot", text: "Original" });
  // The record says so too: the field keeps its text.
  saved.set("Snapshot");
  expect(field.text()).toBe("Original");
  expect(field.dirty()).toBe(true);
});

test("a refused save keeps the text, and tells its caller, so what follows it stops", async () => {
  const field = unsavedText("test:refused", () => "");
  field.change("The notes");
  const steps: Array<string> = [];
  // A round's submit: the notes first, then the round, only once the notes are saved.
  const submit = async () => {
    const notes = await field.save(async () => {
      steps.push("notes");
      throw new Error("The file changed elsewhere.");
    });
    if (!notes.ok) return notes.why;
    steps.push("submit");
    return null;
  };
  expect(await submit()).toBe("The file changed elsewhere.");
  expect(steps).toEqual(["notes"]);
  expect(field.text()).toBe("The notes");
  expect(field.dirty()).toBe(true);
});

test("a save asked twice with the same text is one save, and a newer text waits its turn", async () => {
  const field = unsavedText("test:queue", () => "");
  field.change("A");
  const server = answer();
  const got: Array<string> = [];
  const send = async (text: string) => {
    got.push(text);
    await server.given;
  };
  const first = field.save(send);
  const same = field.save(send);
  field.change("AB");
  const newer = field.save(send);
  server.pass();
  await Promise.all([first, same, newer]);
  expect(got).toEqual(["A", "AB"]);
  expect(field.dirty()).toBe(false);
});

test("a text sent leaves its field at once, and what is typed meanwhile stays when it is taken", async () => {
  const field = unsavedText("test:send", () => "");
  field.change("First message");
  const server = answer();
  const got: Array<string> = [];
  const send = field.send(async (text) => {
    got.push(text);
    await server.given;
  });
  // The field is free for the next message, and a second send waits for the first's answer.
  expect(field.text()).toBe("");
  expect(field.pending()).toBe(true);
  field.change("Second message");
  expect(await field.send(async () => undefined)).toEqual({ ok: false, why: null });
  server.pass();
  expect(await send).toEqual({ ok: true, value: undefined });
  expect(got).toEqual(["First message"]);
  expect(field.text()).toBe("Second message");
  expect(readUnsaved("test:send")).toMatchObject({ text: "Second message" });
  expect(readUnsaved("test:send")?.sent).toBe(undefined);
  expect(field.pending()).toBe(false);
});

test("a text refused comes back before what was typed since, with what was attached", async () => {
  const field = unsavedText("test:back", () => "");
  let images: ReadonlyArray<string> = ["one.png"];
  const held = {
    putBack: (taken: ReadonlyArray<string>) => (images = [...taken, ...images]),
    take: () => {
      const taken = images;
      images = [];
      return taken;
    },
  };
  field.change("First message");
  const server = answer();
  const got: Array<[string, ReadonlyArray<string>]> = [];
  const send = field.send(async (text, attached) => {
    got.push([text, attached]);
    await server.given;
  }, held);
  expect(images).toEqual([]);
  // Another message begun, and an image added, while the first is on its way.
  field.change("Second message");
  images = ["two.png"];
  server.refuse(new Error("The agent is off."));
  expect(await send).toEqual({ ok: false, why: "The agent is off." });
  expect(got).toEqual([["First message", ["one.png"]]]);
  expect(field.text()).toBe("First message\n\nSecond message");
  expect(images).toEqual(["one.png", "two.png"]);
  expect(field.pending()).toBe(false);
});

test("two fields typed in at once are both there after a restart, as is a text the app closed on while sending", async () => {
  await Storage.clear();
  const notes = unsavedText("restart:notes", () => "");
  const comment = unsavedText("restart:comment", () => "As saved");
  for (const typed of ["a", "ab", "abc"]) {
    notes.change(`Notes ${typed}`);
    comment.change(`Comment ${typed}`);
  }
  const message = unsavedText("restart:message", () => "");
  message.change("Sent as the app closed");
  // Never answered: the app closes first.
  void message.send(() => new Promise<void>(() => undefined));
  message.change("and typed after");
  // The app leaves the front: what waited for a pause in the typing is written now.
  device.flush();
  await Storage.getItem("unsaved:restart:notes");

  const restarted = deviceStore<Record<`unsaved:${string}`, { text: string }>>();
  await restarted.load();
  expect(restarted.get("unsaved:restart:notes")?.text).toBe("Notes abc");
  expect(restarted.get("unsaved:restart:comment")?.text).toBe("Comment abc");
  expect(restarted.keys("unsaved:restart:").toSorted()).toEqual([
    "unsaved:restart:comment",
    "unsaved:restart:message",
    "unsaved:restart:notes",
  ]);

  // As the app starts, a text that was on its way is back in its field, before what followed it.
  restoreUnsaved(new Date());
  expect(readUnsaved("restart:message")?.text).toBe("Sent as the app closed\n\nand typed after");
  expect(readUnsaved("restart:message")?.sent).toBe(undefined);
  expect(readUnsaved("restart:notes")?.text).toBe("Notes abc");
  // And what was typed more than 30 days ago goes.
  restoreUnsaved(new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
  expect(readUnsaved("restart:notes")).toBe(undefined);
});
