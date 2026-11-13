// What `WebFrame` hears of its page in a browser, where Native Shell's web view is an `<iframe>`
// of the page around the app. A page of the server's own origin loads sandboxed, without that
// origin, so Native Shell runs no script in it and passes none of its messages on: the page's own
// `window.parent.postMessage`, as a story's pick script posts, reaches the page around the app,
// and the frame hears it there. The keys are in the page while its `<iframe>` has the focus.

/** What the frame reads of the browser's page around the app. */
type Page = {
  addEventListener(type: string, listener: (event: never) => void): void;
  document: {
    readonly activeElement: unknown;
    querySelectorAll(
      selector: "iframe",
    ): Iterable<{ contentWindow: unknown; getAttribute(name: string): string | null }>;
  };
  removeEventListener(type: string, listener: (event: never) => void): void;
};

/** The page around the app: Native Shell runs its code in a frame of the page's own origin. */
const page = () => (globalThis as unknown as { top: Page }).top;

/** What a story's page says to the app, as the pick script posts it. */
const SAID = new Set(["ready", "size", "picked", "pick-stopped"]);

/**
 * Hears what the frame showing `src` posts to its parent, and when the keys go into it and come
 * out: `stop` ends both.
 */
export function hearFrame(
  src: () => string | undefined,
  heard: (data: unknown) => void,
  keys: (inPage: boolean) => void,
): () => void {
  const frames = () =>
    [...page().document.querySelectorAll("iframe")].filter(
      (frame) => src() !== undefined && frame.getAttribute("src") === src(),
    );
  const message = (event: { data: unknown; source: unknown }) => {
    const data = event.data as { uraeda?: unknown } | null;
    if (typeof data !== "object" || data === null || !SAID.has(String(data.uraeda))) return;
    if (frames().some((frame) => frame.contentWindow === event.source)) heard(data);
  };
  let inPage = false;
  // The page loses the focus to a frame, or gets it back: which frame, once the move is done.
  const moved = () =>
    setTimeout(() => {
      const now = frames().some((frame) => frame === page().document.activeElement);
      if (now !== inPage) keys((inPage = now));
    }, 0);
  page().addEventListener("message", message);
  page().addEventListener("blur", moved);
  page().addEventListener("focus", moved);
  return () => {
    page().removeEventListener("message", message);
    page().removeEventListener("blur", moved);
    page().removeEventListener("focus", moved);
  };
}
