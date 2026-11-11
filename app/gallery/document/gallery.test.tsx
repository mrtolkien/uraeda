// The pictures of the document renderer's gallery pages. Without a display, `just app-test` only
// checks that each page mounts. On the hidden display, `just gallery-shots document` saves a
// picture of each in `target/shots/gallery/`, in both themes, at a desktop's and a phone's width:
// the spec at its top and scrolled to its table and code, the diagrams, and the reply once whole.
import { type App, expect, open, test } from "nsh/test";

const SHOTS = "../target/shots/gallery";

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

const page = (name: string, theme: string, width: number) =>
  open("./Document.tsx", {
    colorScheme: theme as "dark" | "light",
    height: 800,
    host: { params: { page: name, piece: "400", sections: "3", theme } },
    width,
  });

for (const theme of ["dark", "light"]) {
  for (const width of [1400, 390]) {
    test(`the document page spec draws, ${theme}, ${width} wide`, async () => {
      const app = await page("spec", theme, width);
      expect(app.texts().join(" ")).toContain("Recurring tasks");
      if (!(await draws(app))) return;
      await app.wait(1500);
      await app.screenshot(`${SHOTS}/document-spec-${theme}-${width}.png`);
      await app.scroll("id:scroll", width < 768 ? 1300 : 700);
      await app.wait(600);
      await app.screenshot(`${SHOTS}/document-spec-lower-${theme}-${width}.png`);
      await app.scroll("id:scroll", width < 768 ? 1100 : 700);
      await app.wait(600);
      await app.screenshot(`${SHOTS}/document-spec-end-${theme}-${width}.png`);
    });

    test(`the document page diagrams draws, ${theme}, ${width} wide`, async () => {
      const app = await page("diagrams", theme, width);
      await app.waitUntil(() => app.texts().join(" ").includes("could not be drawn"));
      if (!(await draws(app))) return;
      await app.wait(1000);
      await app.screenshot(`${SHOTS}/document-diagrams-${theme}-${width}.png`);
    });

    test(`the document page reply draws, ${theme}, ${width} wide`, async () => {
      const app = await page("reply", theme, width);
      await app.host.send("grow");
      await app.wait(500);
      await app.host.send("end");
      expect(app.texts().join(" ")).toContain("Step 3");
      if (!(await draws(app))) return;
      await app.wait(1500);
      await app.screenshot(`${SHOTS}/document-reply-${theme}-${width}.png`);
    });
  }
}
