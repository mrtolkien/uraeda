// What a frame costs with the glass bar over a transcript of 20,000 rows that scrolls fast by
// itself, then without the bar, to tell the bar's own cost from the page's. `just samples-frames`
// runs it on the hidden display, where Native Shell logs its frame timing once a second, as
// `nsh::perf` lines. Without a display there is no frame to time.
import { open, test } from "nsh/test";

const SECONDS = 30;

for (const bar of [true, false]) {
  test(
    `a scrolling transcript ${bar ? "under the glass bar" : "with no bar"}, for its frames`,
    async () => {
      const app = await open("./Samples.tsx", {
        width: 1400,
        height: 800,
        colorScheme: "dark",
        host: { params: { sample: "glass", theme: "dark", rows: 20_000, bar } },
      });
      try {
        await app.screenshot();
      } catch (error) {
        if (!String(error).includes("real platform")) throw error;
        return;
      }
      await app.host.send("sweep");
      await app.wait(SECONDS * 1000);
    },
    (SECONDS + 30) * 1000,
  );
}
