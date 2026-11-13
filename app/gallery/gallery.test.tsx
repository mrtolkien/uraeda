// The gallery's pictures, and the behaviour of the pages that type and open. Without a display,
// `just app-test` checks that each page mounts in the gallery and shows what it should, in the
// dark theme. On the hidden display, `just gallery-shots [word]` saves a picture of every page, in
// both themes, at 1400, 900, and 390 points wide, in `target/shots/gallery/`, as
// `<group>-<page>-<theme>-<width>.png`: all of them, or the tests whose name holds the word.
import { type App, expect, open, test } from "nsh/test";
import { CATALOGUE } from "./catalogue";

const SHOTS = "../target/shots/gallery";
const THEMES = ["dark", "light"] as const;
const WIDTHS = [1400, 900, 390] as const;

type Params = Record<string, string>;

const gallery = (params: Params, theme = "dark", width = 1400) =>
  open("./Gallery.tsx", {
    colorScheme: theme as "dark" | "light",
    height: 800,
    host: { params: { ...params, theme } },
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

/** The page's text, once it shows it: a diagram and a reply take a moment. */
const shows = (app: App, text: string) => app.waitUntil(() => app.texts().join(" ").includes(text));

/**
 * Opens `params` in the dark theme at 1400 and checks it shows `text`; on the hidden display,
 * pictures it in each theme at each width, after `then` ran, as `name`.
 */
async function pictures(
  name: string,
  params: Params,
  text: string,
  then?: (app: App) => Promise<void>,
) {
  const first = await gallery(params);
  await shows(first, text);
  if (!(await draws(first))) return;
  // One picture after the other: two windows at once would share the machine's frames.
  const each = THEMES.flatMap((theme) => WIDTHS.map((width) => [theme, width] as const));
  await each.reduce<Promise<void>>(
    (done, [theme, width]) =>
      done.then(async () => {
        const app = await gallery(params, theme, width);
        await shows(app, text);
        await then?.(app);
        // The shaders' frames come back a frame or two after they are drawn.
        await app.wait(1500);
        await app.screenshot(`${SHOTS}/${name}-${theme}-${width}.png`);
      }),
    Promise.resolve(),
  );
}

const LONG = 180_000;

for (const group of CATALOGUE) {
  for (const page of group.pages) {
    test(
      `${group.name}: the page ${page.name} draws`,
      () =>
        pictures(`${group.name}-${page.name}`, { page: page.name }, page.shows, async (app) => {
          // The tip shows once the pointer rested on what it is about.
          if (page.name === "tip") await app.hover("id:tipped");
        }),
      LONG,
    );
  }
}

// Each layout, with a text its focused pane shows at every width: a phone shows that pane alone.
for (const [layout, text] of [
  ["tabs", "Transcript"],
  ["split", "Changes"],
  ["folded", "Transcript"],
  ["open", "Transcript"],
] as const) {
  test(
    `panes: the frame draws, ${layout}`,
    () => pictures(`panes-${layout}`, { group: "panes", layout }, text),
    LONG,
  );
}

for (const view of [
  ["leader", "Keyboard shortcuts"],
  ["map", "Keyboard shortcuts"],
  ["picker", "Recurring tasks · plan"],
] as const) {
  test(
    `keys: the ${view[0]} opens`,
    () => pictures(`keys-${view[0]}`, { open: view[0], page: "keys" }, view[1]),
    LONG,
  );
}

test(
  "document: the spec draws its table and its code, lower down",
  () =>
    pictures("document-spec-lower", { page: "spec" }, "Recurring tasks", async (app) => {
      await app.scroll("id:page-spec", 900);
    }),
  LONG,
);

/** Presses `keys` one after the other, as typed. */
const press = (app: App, keys: ReadonlyArray<string>) =>
  keys.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)),
    Promise.resolve(),
  );

for (const vim of ["off", "on"]) {
  test(`text: a field takes typing, Vim ${vim}`, async () => {
    const app = await gallery({ page: "fields", vim });
    await shows(app, "Vim's modes");
    await app.type("id:typed", "");
    await press(
      app,
      [..."one two three", "shift+1"].map((key) => (key === " " ? "space" : key)),
    );
    expect(app.texts().join(" ")).toContain(vim === "on" ? "Live: INSERT" : "Live: no field");
    if (vim === "on") {
      // Back to normal mode, and a jump to the line's start.
      await app.keyboard.press("escape");
      await app.keyboard.press("0");
      await press(app, ["d", "w"]);
      expect(app.texts().join(" ")).toContain("Live: NORMAL");
    }
    if (!(await draws(app))) return;
    await app.wait(600);
    await app.screenshot(`${SHOTS}/text-typed-vim-${vim}.png`);
  });
}
