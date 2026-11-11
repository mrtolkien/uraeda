// What the text field guarantees that using it would not show at once: unsaved text survives a
// restart, Escape in Vim's normal mode is the field's own Escape, in a page and in a dialog, a yank reaches the system
// clipboard, a field with Vim off never reaches the Vim layer, and a composer sends what is attached
// without words.
import { type App, expect, open, test } from "nsh/test";

/** Presses `keys` one after the other, as typed. */
const press = (app: App, keys: ReadonlyArray<string>) =>
  keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );

const page = (vim: "on" | "off", storage?: Record<string, string>) =>
  open("./__checks__/text.tsx", { height: 800, host: { params: { vim } }, storage, width: 1400 });

test("unsaved text comes back after a restart", async () => {
  const before = await page("off");
  await before.type("id:note", "A draft. ");
  expect(before.texts()).toContain("Unsaved changes");
  await before.waitUntil(() => JSON.stringify(before.storage()).includes("A draft."));

  const after = await page("off", before.storage());
  expect(after.texts()).toContain("Unsaved changes");
  expect(after.texts()).toContain("Note: A draft. Saved text");
});

test("Escape in normal mode does what Escape does without Vim", async () => {
  // Without Vim, Escape leaves the field, keeping its text.
  const plain = await page("off");
  await plain.type("id:note", "A ");
  expect(plain.texts()).toContain("Typing in the note");
  await plain.keyboard.press("escape");
  expect(plain.texts()).toContain("Not typing");
  expect(plain.texts()).toContain("Note: A Saved text");

  // With Vim, the field opens typing: Escape goes to normal mode, and the next one is the same.
  const vim = await page("on");
  await vim.type("id:note", "A ");
  expect(vim.texts()).toContain("Mode: INSERT");
  await vim.keyboard.press("escape");
  expect(vim.texts()).toContain("Mode: NORMAL");
  expect(vim.texts()).toContain("Typing in the note");
  await vim.keyboard.press("escape");
  expect(vim.texts()).toContain("Not typing");
  expect(vim.texts()).toContain("Note: A Saved text");
});

test("Escape in a dialog's field leaves insert mode first, and closes the dialog second", async () => {
  const app = await page("on");
  await app.press("id:ask");
  expect(app.texts()).toContain("Dialog open");
  await app.type("id:name", "Ada");
  expect(app.texts()).toContain("Mode: INSERT");
  await app.keyboard.press("escape");
  expect(app.texts()).toContain("Mode: NORMAL");
  expect(app.texts()).toContain("Dialog open");
  await app.keyboard.press("escape");
  expect(app.texts()).toContain("Dialog closed");
});

test("a yank reaches the system clipboard", async () => {
  const app = await page("on");
  // The field takes the focus, and opens typing.
  await app.type("id:note", "");
  await app.keyboard.press("escape");
  await press(app, ["0", "y", "w"]);
  expect(app.clipboard()).toBe("Saved ");
  // A delete never replaces what was copied.
  await app.keyboard.press("x");
  expect(app.texts()).toContain("Note: aved text");
  expect(app.clipboard()).toBe("Saved ");
});

test("a field with Vim off never calls the bridge", async () => {
  const app = await page("off");
  await app.type("id:note", "dd");
  await app.keyboard.press("escape");
  await app.press("id:count");
  expect(app.texts()).toContain("Note: ddSaved text");
  expect(app.texts()).toContain("Taken by Vim: 0");
});

test("a composer sends what is attached without words, and refuses nothing at all", async () => {
  const app = await page("off");
  await app.press("label:Send");
  expect(app.texts()).toContain("Sent: 1");
  await app.type("label:Message", "");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Sent: 2");

  // Nothing attached and no words: Send is off, and Enter sends nothing.
  await app.press("id:detach");
  const refused = await app.press("label:Send").then(
    () => "pressed",
    (error: unknown) => String(error),
  );
  expect(refused).toContain("is disabled");
  await app.type("label:Message", "");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Sent: 2");
});
