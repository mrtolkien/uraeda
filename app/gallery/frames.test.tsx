// What a frame of each scene costs: `just frames <scene>` runs one on the hidden display, where
// Native Shell logs its frame timing once a second, as `nsh::perf` lines, and sums them up. The
// scene runs a few seconds before its frames count, and the lines between `frames: from` and
// `frames: to` are the scene's. Without a display there is no frame to time.
import { open, test } from "nsh/test";

/** How long a scene settles first, and how long its frames are counted, in seconds. */
const SETTLE = 4;
const SECONDS = 30;

for (const scene of ["streaming", "scrolling", "glass"]) {
  test(
    `the scene ${scene}, for its frames`,
    async () => {
      const app = await open("./Gallery.tsx", {
        colorScheme: "dark",
        height: 800,
        host: { params: { page: scene, theme: "dark" } },
        width: 1400,
      });
      try {
        await app.screenshot();
      } catch (error) {
        if (!String(error).includes("real platform")) throw error;
        return;
      }
      await app.wait(SETTLE * 1000);
      console.log(`frames: from ${scene}`);
      await app.wait(SECONDS * 1000);
      console.log(`frames: to ${scene}`);
      // Where the scene ended: a streaming one still at its end, a scrolling one still moving.
      await app.screenshot(`../target/shots/gallery/frames-${scene}-end.png`);
    },
    (SETTLE + SECONDS + 30) * 1000,
  );
}
