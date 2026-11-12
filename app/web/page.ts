// The browser's page around the app. Native Shell runs the app's code in a frame of the page's
// own origin, so the page's window, its address and its history, is the frame's `top`. Only the
// web's own files read it: the screens never do.
import type { BrowserPage } from "../store/history.web";

/** What the app reads of the page's window, beside its history. */
export type PageWindow = BrowserPage & {
  addEventListener(type: string, listener: (event: never) => void): void;
  focus(): void;
  removeEventListener(type: string, listener: (event: never) => void): void;
  location: BrowserPage["location"] & { readonly origin: string };
};

/** The page's window. */
export const page = (): PageWindow => (globalThis as unknown as { top: PageWindow }).top;
