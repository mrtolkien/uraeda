// What an overlay does with the keyboard focus, which using the app with a pointer would not
// show: it takes the focus as it opens and gives it back where it was, and a dialog keeps Tab
// among its own fields. A key typed goes to the field that has the focus, so the tests type.
import { expect, open, test } from "nsh/test";

const page = () => open("./__checks__/focus.tsx", { height: 800, width: 1400 });

test("an overlay gives the focus back where it was", async () => {
  const app = await page();
  await app.type("id:page", "one");
  expect(app.texts()).toContain("page: one");

  // The focus goes into the dialog as it opens, on its first field.
  await app.keyboard.press("mod+o");
  expect(app.shows("id:dialog")).toBe(true);
  await app.keyboard.press("x");
  expect(app.texts()).toContain("first: x");
  expect(app.texts()).toContain("page: one");

  // And back to the page's field as it closes.
  await app.keyboard.press("escape");
  await app.keyboard.press("y");
  expect(app.texts()).toContain("page: oney");
  await app.wait(400);
  expect(app.shows("id:dialog")).toBe(false);
});

test("a dialog keeps Tab inside itself", async () => {
  const app = await page();
  await app.type("id:page", "one");
  await app.keyboard.press("mod+o");

  await app.keyboard.press("tab");
  await app.keyboard.press("a");
  expect(app.texts()).toContain("second: a");
  // From its last field Tab goes to its first, never to the page's.
  await app.keyboard.press("tab");
  await app.keyboard.press("b");
  expect(app.texts()).toContain("first: b");
  await app.keyboard.press("shift+tab");
  await app.keyboard.press("c");
  expect(app.texts()).toContain("second: ac");
  expect(app.texts()).toContain("page: one");
});

test("on a phone, Back closes a sheet, and a sheet closed otherwise leaves no visit", async () => {
  const app = await open("./__checks__/focus.tsx", { height: 844, width: 390 });
  await app.keyboard.press("mod+o");
  expect(app.shows("id:dialog")).toBe(true);
  // Back closes the sheet, and stays on the page.
  await app.host.send("back", null);
  expect(app.texts()).toContain("back: true");
  await app.wait(400);
  expect(app.shows("id:dialog")).toBe(false);
  // Closed by Escape, its visit goes with it: the next Back has nothing of the page's to close.
  await app.keyboard.press("mod+o");
  await app.keyboard.press("escape");
  await app.wait(400);
  await app.host.send("back", null);
  expect(app.texts()).toContain("back: false");
});

test("on a phone, a swipe down on a sheet's title closes it; a short one leaves it", async () => {
  const app = await open("./__checks__/focus.tsx", { height: 844, width: 390 });
  await app.keyboard.press("mod+o");
  await app.drag("text:A question", { y: 30 });
  await app.wait(400);
  expect(app.shows("id:dialog")).toBe(true);
  await app.drag("text:A question", { y: 200 });
  await app.wait(400);
  expect(app.shows("id:dialog")).toBe(false);
});
