// The samples' pictures. Without a display, `just app-test` only checks that each sample mounts.
// On the hidden display, `just samples-shots` saves a picture of each in `target/shots/samples/`,
// in both themes, with the pairs the checks of the language read: a second picture a moment later,
// which shows what moved by itself, and one with nothing on the glass, which shows what is under
// its text.
import { type App, expect, open, test } from "nsh/test";

const SHOTS = "../target/shots/samples";
const THEMES = ["dark", "light"] as const;
/** Each sample, with a text it shows and whether it has glass with text on it. */
const SAMPLES: [name: string, shows: string, glass: boolean][] = [
  ["heights", "overlay inside", false],
  ["panes", "At rest", false],
  ["glass", "Task 27 · Surfaces", true],
  ["buttons", "Approve", false],
  ["dialog", "Delete task 27?", true],
  ["list", "27 Surfaces", false],
  ["status", "NORMAL", true],
  ["session", "Send", true],
];

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

for (const theme of THEMES) {
  for (const [name, shows, glass] of SAMPLES) {
    test(`the sample ${name} draws, ${theme}`, async () => {
      const app = await open("./Samples.tsx", {
        width: 1400,
        height: 800,
        colorScheme: theme,
        host: { params: { sample: name, theme } },
      });
      expect(app.texts().join(" ")).toContain(shows);
      if (!(await draws(app))) return;
      // The shaders' frames come back a frame or two after they are drawn.
      await app.wait(1200);
      await app.screenshot(`${SHOTS}/${name}-${theme}.png`);
      await app.wait(1500);
      await app.screenshot(`${SHOTS}/${name}-${theme}-later.png`);
      if (glass) {
        await app.host.send("bare");
        await app.wait(600);
        await app.screenshot(`${SHOTS}/${name}-${theme}-bare.png`);
      }
    });
  }
}
