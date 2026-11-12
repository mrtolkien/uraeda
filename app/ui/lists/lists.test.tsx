// What the lists do that a look at the gallery would not show: a focused list shows its cursor on
// its first row before any key, a key's move never leaves the cursor out of sight, half a page by
// Ctrl+D and Ctrl+U, a transcript stops following its end once the reader scrolls away, and a
// reorder by keys moves one row and says where it went.
import { type App, expect, open, test } from "nsh/test";

const ROW = 28;
const HEIGHT = 400;

const page = (check: string) =>
  open("./__checks__/lists.tsx", {
    clock: {},
    height: 800,
    host: { params: { check } },
    width: 1400,
  });

/** Presses a key `times` times, one after the other, as a held key would not. */
async function pressTimes(app: App, key: string, times: number): Promise<void> {
  if (times > 0) {
    await app.keyboard.press(key);
    await pressTimes(app, key, times - 1);
  }
}

/** A number the page says after `label`. */
const said = (texts: ReadonlyArray<string>, label: string) =>
  Number(texts.find((text) => text.startsWith(label))?.slice(label.length));

test("the cursor stays in view as it moves", async () => {
  const app = await page("cursor");
  const inView = async (row: number) => {
    await app.wait(600);
    expect(app.texts()).toContain(`Cursor: r${row}`);
    const offset = said(app.texts(), "Offset: ");
    const top = (row - 1) * ROW;
    expect(top).toBeGreaterThanOrEqual(offset);
    expect(top + ROW).toBeLessThanOrEqual(offset + HEIGHT);
  };
  // Before any key, the cursor is on the first row: the keys go there.
  await inView(1);
  await pressTimes(app, "j", 39);
  await inView(40);
  await app.keyboard.press("shift+g");
  await inView(2000);
  await pressTimes(app, "k", 30);
  await inView(1970);
});

test("Ctrl+D and Ctrl+U move the cursor by half the rows in view", async () => {
  const app = await page("cursor");
  await app.wait(600);
  // 400 points of rows of 28: 14 in view, 7 a half.
  await app.keyboard.press("mod+d");
  await app.wait(300);
  expect(app.texts()).toContain("Cursor: r8");
  await app.keyboard.press("mod+u");
  await app.wait(300);
  expect(app.texts()).toContain("Cursor: r1");
});

test("a list that follows its end stops when the reader scrolls away", async () => {
  const app = await page("follow");
  await app.wait(300);
  const start = said(app.texts(), "Offset: ");
  // It opens at its end, and stays there as a row comes.
  expect(start).toBe(50 * ROW - HEIGHT);
  await app.keyboard.press("a");
  await app.wait(300);
  expect(app.texts()).toContain("Following: yes");
  expect(said(app.texts(), "Offset: ")).toBe(51 * ROW - HEIGHT);
  await app.scroll("Row 45", -300);
  await app.wait(300);
  expect(app.texts()).toContain("Following: no");
  const before = said(app.texts(), "Offset: ");
  await app.keyboard.press("a");
  await app.keyboard.press("a");
  await app.wait(300);
  expect(said(app.texts(), "Offset: ")).toBe(before);
  expect(app.texts()).toContain("Following: no");
});

test('"Jump to the latest" from far back in a long transcript reaches its end', async () => {
  const app = await page("far");
  await app.wait(300);
  expect(said(app.texts(), "Offset: ")).toBe(0);
  expect(app.texts()).toContain("Following: no");
  await app.keyboard.press("e");
  await app.wait(1000);
  // Its last row shows, whole, at the list's bottom.
  expect(app.texts()).toContain("Last shown: 20000");
  expect(app.texts()).toContain("Following: yes");
});

test("a reorder by keys moves one item, and says where it went", async () => {
  const app = await page("order");
  // The cursor is on the first row, Inbox, before any key.
  await app.keyboard.press("m");
  await app.keyboard.press("j");
  await app.keyboard.press("j");
  // Carried, not landed: the screen's order is as it was.
  expect(app.texts()).toContain("Order: Inbox Now Next Later Done");
  await app.keyboard.press("enter");
  await app.wait(300);
  expect(app.texts()).toContain("Order: Now Next Inbox Later Done");
  expect(app.texts()).toContain("Moves: 1");
  expect(app.texts()).toContain("Inbox moved to 3 of 5.");
  // Escape puts a carried row back, and nothing lands.
  await app.keyboard.press("m");
  await app.keyboard.press("k");
  await app.keyboard.press("escape");
  await app.wait(300);
  expect(app.texts()).toContain("Order: Now Next Inbox Later Done");
  expect(app.texts()).toContain("Moves: 1");
});
