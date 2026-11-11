// What the controls do that a look at the gallery would not show: a refusal comes back to the
// control the hand was on, a select works by keyboard alone and gives the focus back, and a
// disabled control is passed by both the pointer and the keys.
import { expect, open, test } from "nsh/test";

const page = () => open("./__checks__/controls.tsx", { clock: {}, height: 800, width: 1400 });

test("a refused switch goes back, and says why under itself", async () => {
  const app = await page();
  await app.press("Night");
  // It moves the moment it is touched.
  expect(app.texts()).toContain("Night: on");
  await app.wait(600);
  expect(app.texts()).toContain("Night: off");
  expect(app.texts()).toContain("Night is set by the system theme here.");
});

test("a select picks by keyboard, and gives the focus back", async () => {
  const app = await page();
  await app.keyboard.press("mod+o");
  // The dialog puts the focus on its select: Enter opens it, `j` moves, Enter picks.
  await app.keyboard.press("enter");
  expect(app.shows("id:model-list")).toBe(true);
  await app.keyboard.press("j");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Model: claude");
  await app.wait(400);
  expect(app.shows("id:model-list")).toBe(false);
  // The focus is back on the select: Enter opens it again.
  await app.keyboard.press("enter");
  expect(app.shows("id:model-list")).toBe(true);
});

test("a disabled control takes neither a tap nor the focus", async () => {
  const app = await page();
  await app.keyboard.press("mod+o");
  await expect(app.press("Archive")).rejects.toMatchObject({ code: "ERR_NSH_TEST_DISABLED" });
  // Tab passes it, from the select to the next control that takes the focus.
  await app.keyboard.press("tab");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Kept: 1");
});
