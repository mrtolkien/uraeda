// Run by `nsh test`, without a display. Tab on a page, which a pointer never shows: it goes
// through the focused pane's controls in order, and only its, Enter presses the control it reached,
// Escape gives the keys back to the pane, and a control that goes with the focus leaves the pane's
// keys working.
import { type App, expect, open, test } from "nsh/test";

const page = async () => {
  const app = await open("./__checks__/focus.tsx", { height: 800, width: 1400 });
  await app.waitFor("text:Row a");
  // The form's pane has the keys once its list's hint shows.
  await app.waitFor("text:move");
  return app;
};

const said = (app: App) => app.texts().find((text) => text.startsWith("Said: ")) ?? "";

/** Presses `key`, then Enter. */
async function andEnter(app: App, key: string) {
  await app.keyboard.press(key);
  await app.keyboard.press("enter");
}

test("Tab goes through the focused pane's controls, and Enter presses the one it reached", async () => {
  const app = await page();
  await andEnter(app, "tab");
  expect(said(app)).toBe("Said: save");
  await andEnter(app, "tab");
  expect(said(app)).toBe("Said: save, reset");
  await andEnter(app, "shift+tab");
  expect(said(app)).toBe("Said: save, reset, save");
  // Reset, the switch, Once, the field, then around to the pane's first, never to the side
  // stack's.
  // oxlint-disable-next-line no-await-in-loop -- keys are pressed one after the other
  for (const _ of [1, 2, 3, 4]) await app.keyboard.press("tab");
  await andEnter(app, "tab");
  expect(said(app)).toBe("Said: save, reset, save, save");
});

test("Escape gives the keys back to the pane: Enter then opens the list's row", async () => {
  const app = await page();
  await app.keyboard.press("tab");
  await app.keyboard.press("escape");
  await app.keyboard.press("j");
  await app.keyboard.press("enter");
  expect(said(app)).toMatch(/^Said: opened [ab]$/);
  // Any other key of the pane takes the focus off the control too.
  await app.keyboard.press("tab");
  await andEnter(app, "j");
  expect(said(app)).toMatch(/^Said: opened [ab], opened [ab]$/);
});

test("a control pressed away leaves the pane's keys working", async () => {
  const app = await page();
  // oxlint-disable-next-line no-await-in-loop -- keys are pressed one after the other
  for (const _ of [1, 2, 3, 4]) await app.keyboard.press("tab");
  await app.keyboard.press("enter");
  expect(said(app)).toBe("Said: once");
  await andEnter(app, "j");
  expect(said(app)).toMatch(/^Said: once, opened [ab]$/);
  // And Tab starts again from the pane's first control.
  await andEnter(app, "tab");
  expect(said(app)).toMatch(/, save$/);
});

test("a control a pointer pressed away leaves the pane's keys working", async () => {
  const app = await page();
  await app.press("label:Once");
  expect(said(app)).toBe("Said: once");
  await andEnter(app, "j");
  expect(said(app)).toMatch(/^Said: once, opened [ab]$/);
});

test("Tab reaches a document's links, and Enter follows the one it reached", async () => {
  const app = await page();
  // Into the side stack, whose document's link comes before its button.
  await app.keyboard.press("l");
  await andEnter(app, "tab");
  expect(said(app)).toBe("Said: followed #guide");
  await andEnter(app, "tab");
  expect(said(app)).toBe("Said: followed #guide, aside");
});

test("a pointer that gives another pane the keys takes the focus off the first pane's control", async () => {
  const app = await page();
  await app.keyboard.press("tab");
  // The side pane's words, which take no focus: the side pane has the keys then.
  await app.press("text:See the guide, then press Aside.");
  await app.keyboard.press("enter");
  expect(said(app)).toBe("Said: nothing");
});
