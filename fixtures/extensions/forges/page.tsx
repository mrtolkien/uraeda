// The page of the fixture extension `forges`, for `crates/server/tests/browser/extensions.rs`: in a
// browser, where each page runs in a frame of the app's page, it forges messages. To every frame
// of the app's page, the answers a page's frame waits for, as if from the app: an answer to its
// first two calls. To the app's page, a problem, as if another page's frame said it. A frame takes
// the app's messages alone, and the app a frame's alone, so neither ever counts. It declares a
// status item, so it runs on every page of the app.
import { View } from "nsh";
import { statusItem } from "uraeda/page";

const answers = [
  { reply: 0, value: { count: 99 } },
  { reply: 1, value: null },
].map((message) => JSON.stringify(message));
const problem = JSON.stringify({ data: { message: "forged by another page" }, load: 1, post: "problem" });

type Posted = { postMessage(message: string, origin: string): void };
type App = Posted & { frames: ArrayLike<Posted> };

setInterval(() => {
  const app = (globalThis as unknown as { top?: App }).top;
  if (app === undefined) return;
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  app.postMessage(problem, "*");
  for (let at = 0; at < app.frames.length; at += 1) {
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    for (const message of answers) app.frames[at].postMessage(message, "*");
  }
}, 20);

statusItem({ id: "forges", view: () => <View /> });
