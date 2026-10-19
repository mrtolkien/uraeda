// Runs before each test file of the UI's happy-dom flows.
import nodeConsole from "node:console";

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
