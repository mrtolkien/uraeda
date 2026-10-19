// Runs before each test file of the UI's happy-dom flows.
import nodeConsole from "node:console";
import { configure } from "@testing-library/react";

/**
 * A wait for the page ends when the page is there, so a long limit costs nothing when it passes:
 * `ready` runs the Rust, the browser, and the happy-dom tests at once, and the default second is
 * too short for a page drawn while the machine is full. A failing wait takes the limit to fail.
 */
configure({ asyncUtilTimeout: 10_000 });

/**
 * happy-dom prints an error for each frame it does not load, as `vite.config.ts` asks of it, on the
 * console it was made with: Node's own, which Vitest's console does not replace. A mockup's frame
 * is not loaded on purpose, so its error is left out.
 */
const error = nodeConsole.error.bind(nodeConsole);
nodeConsole.error = (...data: Array<unknown>) => {
  const [first] = data;
  if (
    first instanceof Error &&
    first.name === "NotSupportedError" &&
    first.message.includes("Iframe page loading is disabled")
  ) {
    return;
  }
  error(...data);
};

/**
 * happy-dom has no Popover API, and no browser's own rule hiding a popover until it is shown:
 * Astryx's layers then show and hide themselves by their `display`, and a closed one, never shown,
 * would be on the page. The browsers' rule, written here, hides it. Lint's tests have no page.
 */
if (typeof document !== "undefined") {
  const popovers = document.createElement("style");
  popovers.textContent = "[popover] { display: none; }";
  document.head.append(popovers);
}
