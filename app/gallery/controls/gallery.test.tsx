// The pictures of the controls' gallery pages. Without a display, `just app-test` only checks
// that each page mounts. On the hidden display, `just gallery-shots` saves a picture of each in
// `target/shots/gallery/`, in both themes, at a desktop's and a phone's width.
import { type App, expect, open, test } from "nsh/test";

const SHOTS = "../target/shots/gallery";
const THEMES = ["dark", "light"] as const;
const WIDTHS = [1400, 390] as const;
/** Each page, with a text it shows. */
const PAGES: Array<[name: string, shows: string]> = [
  ["buttons", "Approve"],
  ["choices", "Night"],
  ["words", "Importing sessions"],
  ["icons", "file-text"],
  ["select", "Claude Code"],
  ["menu", "Copy its path"],
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
  for (const width of WIDTHS) {
    for (const [name, shows] of PAGES) {
      test(`the page ${name} draws, ${theme}, ${width} wide`, async () => {
        const app = await open("./Controls.tsx", {
          colorScheme: theme,
          height: 800,
          host: { params: { page: name, theme } },
          width,
        });
        expect(app.texts().join(" ")).toContain(shows);
        if (!(await draws(app))) return;
        // The shaders' frames come back a frame or two after they are drawn.
        await app.wait(1500);
        await app.screenshot(`${SHOTS}/${name}-${theme}-${width}.png`);
      });
    }
  }
}
