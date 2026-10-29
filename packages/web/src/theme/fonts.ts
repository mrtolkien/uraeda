// TEMPORARY: the Monaspace experiment's switch, kept in this browser: the current fonts, Inter and
// JetBrains Mono, or Monaspace's five faces (`monaspace.css`), named on the root element as
// `data-fonts`. One choice for the whole app: the settings' control and `Space u f` show and pick
// the same.
import { useSyncExternalStore } from "react";

/** The fonts picked: the current ones, or Monaspace's. */
export type Fonts = "current" | "monaspace";

const KEY = "uraeda.fonts";

/** The fonts picked on this browser, the current ones when none or when storage is unavailable. */
function readFonts(): Fonts {
  try {
    return window.localStorage.getItem(KEY) === "monaspace" ? "monaspace" : "current";
  } catch {
    return "current";
  }
}

/** Names `fonts` on the root element, which `monaspace.css` reads. */
function apply(fonts: Fonts) {
  if (fonts === "monaspace") {
    document.documentElement.dataset.fonts = "monaspace";
  } else {
    delete document.documentElement.dataset.fonts;
  }
}

/** Names the fonts picked on the root element, before the app draws, so no text changes face. */
export function applyStoredFonts() {
  apply(readFonts());
}

/** What re-reads the fonts picked, one for each component that shows them. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The fonts picked, and the function that picks others. */
export function useFonts(): [Fonts, (fonts: Fonts) => void] {
  const fonts = useSyncExternalStore(subscribe, readFonts, () => "current" as const);
  const set = (next: Fonts) => {
    try {
      if (next === "current") {
        window.localStorage.removeItem(KEY);
      } else {
        window.localStorage.setItem(KEY, next);
      }
    } catch {
      // Private windows may refuse storage: the choice lasts until the page reloads.
    }
    apply(next);
    for (const listener of listeners) {
      listener();
    }
  };
  return [fonts, set];
}
