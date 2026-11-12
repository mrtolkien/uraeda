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
