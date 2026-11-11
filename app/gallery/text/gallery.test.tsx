// The text field's gallery page as pictures, and typed in with real keys. Without a display,
// `just app-test` only checks that it mounts and takes typing. On the hidden display,
// `just gallery-shots field` saves its pictures in `target/shots/gallery/`, in both themes, at a
// desktop's and a phone's width, and pictures of a field typed in with Vim on and off, a jump's
// trail caught as it closes.
import { type App, expect, open, test } from "nsh/test";

const SHOTS = "../target/shots/gallery";

/** Presses `keys` one after the other, as typed. */
const press = (app: App, keys: ReadonlyArray<string>) =>
  keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );

const page = (theme: string, width: number, vim = "off") =>
  open("./Fields.tsx", {
    colorScheme: theme as "dark" | "light",
    height: 800,
    host: { params: { theme, vim } },
    width,
  });

/** Whether the run draws the app: `nsh test` alone has no display, and takes no picture. */
async function draws(app: App): Promise<boolean> {
  try {
    await app.screenshot();
    return true;
  } catch (error) {
    if (!String(error).includes("real platform")) throw error;
    return false;
  }
}

for (const theme of ["dark", "light"]) {
  for (const width of [1400, 390]) {
    test(`the page field draws, ${theme}, ${width} wide`, async () => {
      const app = await page(theme, width);
      expect(app.texts().join(" ")).toContain("Vim's modes");
      if (!(await draws(app))) return;
      await app.wait(1500);
      await app.screenshot(`${SHOTS}/field-${theme}-${width}.png`);
    });
  }
}

for (const vim of ["off", "on"]) {
  test(`the field field takes typing, Vim ${vim}`, async () => {
    const app = await page("dark", 1400, vim);
    await app.type("id:typed", "");
    const shots = await draws(app);
    await press(
      app,
      [..."one two three", "shift+1"].map((key) => (key === " " ? "space" : key)),
    );
    expect(app.texts().join(" ")).toContain(vim === "on" ? "Live: INSERT" : "Live: no field");
    if (vim === "on") {
      // Back to normal mode, a jump to the line's start, and its trail as it closes.
      await app.keyboard.press("escape");
      await app.keyboard.press("0");
      if (shots) await app.screenshot(`${SHOTS}/field-typed-vim-trail.png`);
      await press(app, ["d", "w"]);
      expect(app.texts().join(" ")).toContain("Live: NORMAL");
      console.log(app.texts().find((text) => text.startsWith("Vim:")));
    }
    if (!shots) return;
    await app.wait(600);
    await app.screenshot(`${SHOTS}/field-typed-vim-${vim}.png`);
  });
}
