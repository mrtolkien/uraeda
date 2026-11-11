// What the settings' rows guarantee that a look at a picture would not show: a control moves the
// moment it is touched, by the keys as by a press, and a refusal puts it back and says why under
// its row (rule 6 of "What makes a screen good").
import { expect, open, test } from "nsh/test";

const page = () => open("./__checks__/row.tsx", { clock: {}, height: 600, width: 1200 });

test("a setting refused by the server goes back, and says why under itself", async () => {
  const app = await page();
  // `j` `j` reach the second row, Enter changes its setting, as a press on its switch would.
  await app.keyboard.press("j");
  await app.keyboard.press("j");
  await app.keyboard.press("enter");
  expect(app.texts()).toContain("Vim: on");
  await app.wait(600);
  expect(app.texts()).toContain("Vim: off");
  expect(app.texts()).toContain(
    "config.toml cannot be written: its folder is read-only. Make it writable.",
  );
});
