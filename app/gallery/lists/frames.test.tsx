// What a frame costs with the list of 20,000 rows scrolling fast by itself. `just lists-frames`
// runs it on the hidden display, where Native Shell logs its frame timing once a second, as
// `nsh::perf` lines. Without a display there is no frame to time.
import { open, test } from "nsh/test";

const SECONDS = 30;

test(
  "a list of 20,000 rows scrolling, for its frames",
  async () => {
    const app = await open("./Lists.tsx", {
      colorScheme: "dark",
      height: 800,
      host: { params: { page: "scroll", theme: "dark" } },
      width: 1400,
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
