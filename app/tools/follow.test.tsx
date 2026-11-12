// Whether a session's transcript keeps a streaming reply's end in view, on GTK, as the owner meets
// it: `just follow-check [filter]` writes a chat on the sandbox, asks for a reply at length, and
// looks every 200 ms at whether "Jump to the latest" shows, through the steps of the spec's first
// story: watched untouched, left by keys, `G`, left by a scroll, "Jump to the latest". While the
// list should follow, a look that finds the button is a look that found the reply left behind;
// while the reader is away, one that misses it is the reader pulled back. Each step's picture goes
// in `target/shots/polish-9/`. The counts are printed as `follow:` lines.
//
// Only a real platform scrolls a list as its rows are measured: `nsh test` without a display skips
// every case, so it is a tool to run, never part of a check.
import { type App, expect, open, test } from "nsh/test";

const SHOTS = "../target/shots/polish-9";
const LONG = 300_000;
const LOOK = 200;

/** The keys that type `char`, as a person's hands do. */
const keyOf = (char: string) =>
  char === " " ? "space" : /[A-Z]/.test(char) ? `shift+${char.toLowerCase()}` : char;

async function draws(app: App): Promise<boolean> {
  try {
    await app.screenshot();
    return true;
  } catch (error) {
    if (!String(error).includes("real platform")) throw error;
    return false;
  }
}

/** Presses keys one after the other, as a person does. */
const keys = (app: App, ...pressed: ReadonlyArray<string>) =>
  pressed.reduce<Promise<void>>(
    (done, key) => done.then(() => app.keyboard.press(key)).then(() => app.wait(150)),
    Promise.resolve(),
  );

/** Looks every 200 ms for `ms`: how many looks found "Jump to the latest". */
async function looks(app: App, ms: number): Promise<{ shown: number; of: number }> {
  const seen: boolean[] = [];
  const look = async (left: number): Promise<void> => {
    if (left <= 0) return;
    await app.wait(LOOK);
    seen.push(app.shows("id:jump-to-latest"));
    await look(left - LOOK);
  };
  await look(ms);
  return { of: seen.length, shown: seen.filter(Boolean).length };
}

const said = (step: string, counted: { shown: number; of: number }) =>
  console.log(`follow: ${step}: "Jump to the latest" in ${counted.shown} of ${counted.of} looks`);

for (const [theme, width] of [
  ["dark", 1400],
  ["light", 1400],
  ["dark", 390],
] as const) {
  test(
    `a reply at length is followed, left, and followed again, ${theme} at ${width}`,
    async () => {
      const app = await open("./__checks__/Walk.tsx", {
        colorScheme: theme,
        height: 900,
        host: { params: { theme } },
        network: "live",
        width,
      });
      if (!(await draws(app))) return;
      const shot = (name: string) => app.screenshot(`${SHOTS}/${theme}-${width}-${name}.png`);
      try {
        await app.waitUntil(() => app.shows("id:frame"), { timeout: 30_000 });
        await app.host.send("go", "/r/sample/sessions");
        await app.wait(2500);
        await app.press("text:New chat");
        await app.wait(2000);
        await app.press("text:Ask the agent anything about this repository");
        await keys(app, ...[..."Explain the store at length, with code"].map(keyOf));
        // Its send button: on a phone, Enter puts a line in the draft.
        await app.press("label:Send");
        await app.wait(1500);

        const watched = await looks(app, 10_000);
        said(`${theme} ${width} watched`, watched);
        await shot("1-watched");

        await keys(app, "Escape", "k", "k", "k", "k", "k");
        const left = await looks(app, 2500);
        said(`${theme} ${width} left by keys`, left);
        await shot("2-left-by-keys");

        await keys(app, "shift+g");
        await app.wait(300);
        const back = await looks(app, 6000);
        said(`${theme} ${width} after G`, back);
        await shot("3-after-G");

        await app.scroll("id:transcript", -500);
        await app.wait(600);
        const scrolled = await looks(app, 2500);
        said(`${theme} ${width} left by a scroll`, scrolled);
        await shot("4-left-by-a-scroll");

        await app.press("id:jump-to-latest");
        await app.wait(300);
        const jumped = await looks(app, 6000);
        said(`${theme} ${width} after the jump`, jumped);
        await shot("5-after-the-jump");

        expect(watched.shown).toBe(0);
        expect(left.shown).toBe(left.of);
        expect(back.shown).toBe(0);
        expect(scrolled.shown).toBe(scrolled.of);
        expect(jumped.shown).toBe(0);
      } finally {
        app.dispose();
      }
    },
    LONG,
  );
}
