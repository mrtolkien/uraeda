// What a frame costs while a long reply grows, its last block changing on every frame. `just
// document-frames` runs it on the hidden display, where Native Shell logs its frame timing once a
// second, as `nsh::perf` lines: a reply of 40 sections grows by 12 characters a frame, about 25,000
// characters in all, so its first seconds are a short reply and its last a long one. Without a
// display there is no frame to time.
import { open, test } from "nsh/test";

const SECONDS = 40;

test(
  "a long reply growing, for its frames",
  async () => {
    const app = await open("./Document.tsx", {
      colorScheme: "dark",
      height: 800,
      host: { params: { page: "reply", piece: "12", sections: "40", theme: "dark" } },
      width: 1400,
    });
    try {
      await app.screenshot();
    } catch (error) {
      if (!String(error).includes("real platform")) throw error;
      return;
    }
    await app.host.send("grow");
    await app.wait(SECONDS * 1000);
  },
  (SECONDS + 30) * 1000,
);
