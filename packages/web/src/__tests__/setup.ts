// Runs before each test file of the UI's happy-dom tests.
import nodeConsole from "node:console";
import { afterEach } from "vite-plus/test";
import { resetHeld } from "../cursor/held.ts";
import { endJump } from "../roundJump.ts";

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

/**
 * happy-dom fires `selectionchange` at once, inside the code that moved the selection, where a
 * browser fires it later, as a task of its own. CodeMirror moves the page's selection as it draws an
 * update, and reads `selectionchange` as the human's: fired at once, it starts an update inside its
 * own, and fired later, happy-dom's selection, which it cannot lay out, never settles into the one
 * drawn, so each one fires the next. Nothing else in the app listens for it: the tests set an
 * editor's selection through its view, and the event is not fired.
 */
if (typeof document !== "undefined") {
  const dispatch = document.dispatchEvent.bind(document);
  document.dispatchEvent = (event: Event) => event.type === "selectionchange" || dispatch(event);
}

/**
 * A jump ends a second after its scroll's last move: one a test started would end after the test
 * file's page is gone, its timer then reaching for a `window` that is no more. Each test ends its.
 * The keyboard's cursor remembers whether the last input was a key: each test starts with none.
 */
if (typeof window !== "undefined") {
  afterEach(() => {
    endJump();
    resetHeld();
  });
}
