// The inbox against the real server, on the sandbox `just app-test` starts. Each test makes a note
// of its own.
import { expect, open, test } from "nsh/test";

test("i edits a note in its own pane, as everywhere else", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  // Its text is its own slug, so its address is known: `/inbox/<slug>`.
  const note = `edit-me-${Date.now()}`;
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("id:inbox-new-note", { timeout: 20_000 });
  await app.type("id:inbox-new-note", note);
  await app.keyboard.press("Enter");
  await app.waitFor(`text:Added “${note}”.`, { timeout: 15_000 });
  await app.host.send("go", `/r/sample/inbox/${note}`);
  await app.waitFor("label:The note", { timeout: 15_000 });
  // The address opens the list beside it: `l` crosses to the note's pane.
  await app.keyboard.press("Escape");
  await app.keyboard.press("l");

  // Without `i`, these keys would reach the page: `x` and `z` mean nothing there, nor in the field.
  await app.keyboard.press("i");
  await app.keyboard.press("End");
  await app.keyboard.press("x");
  await app.keyboard.press("z");
  await app.waitUntil(() => app.value("label:The note")?.endsWith("xz") === true, {
    timeout: 5_000,
  });
  expect(app.value("label:The note")).toContain("xz");
  app.dispose();
}, 90_000);

test("a note is added by its button too, as a hand that does not press Enter", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  const note = `pressed-${Date.now()}`;
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("id:inbox-new-note", { timeout: 20_000 });
  expect(app.enabled("id:inbox-add-note")).toBe(false);
  await app.type("id:inbox-new-note", note);
  await app.press("id:inbox-add-note");
  await app.waitFor(`text:Added “${note}”.`, { timeout: 15_000 });
  // It is a note of the list, under the field.
  await app.waitFor(`text:${note}`, { timeout: 15_000 });
  app.dispose();
}, 90_000);

test("in a picker, the row under the pointer is the one Enter picks", async () => {
  const app = await open("../shell/__checks__/Places.tsx", {
    height: 800,
    host: { handlers: { places: null, problem: null, shown: null } },
    network: "live",
    platform: "linux",
    width: 1400,
  });
  await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
  const note = `pointed-${Date.now()}`;
  await app.host.send("go", "/r/sample/inbox");
  await app.waitFor("id:inbox-new-note", { timeout: 20_000 });
  await app.type("id:inbox-new-note", note);
  await app.keyboard.press("Enter");
  await app.waitFor(`text:Added “${note}”.`, { timeout: 15_000 });
  await app.host.send("go", `/r/sample/inbox/${note}`);
  await app.waitFor("text:Move to a category", { timeout: 15_000 });
  // The picker opens on its first category, UI; the pointer rests on CLI, and Enter takes it.
  await app.press("text:Move to a category");
  await app.waitFor("id:key-picker-filter", { timeout: 10_000 });
  await app.hover("text:CLI >> nth=1");
  await app.keyboard.press("Enter");
  // The note's pane names its category over it: CLI, not UI, which Enter held before.
  await app.waitUntil(
    () => app.texts().join(" ").includes(`CLI ${note} c Move to a category`),
    { timeout: 15_000 },
  );
  app.dispose();
}, 90_000);
