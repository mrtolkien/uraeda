// The sandbox's picker: it mounts the bar in a root of its own, beside the app's, runs pick mode
// through the skill's pick script, which the page loads at its top, and copies each pick. The app's
// own entry knows nothing of it. Only the sandbox's page loads it.
import { Theme } from "@astryxdesign/core/theme";
import { useEffect, useEffectEvent, useState } from "react";
import { createRoot } from "react-dom/client";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { elementOf, type Pick, pickText } from "./pickText.ts";
import { type PickStatus, SandboxBar } from "./SandboxBar.tsx";

/**
 * The keyboard shortcut that turns pick mode on and off, as `aria-keyshortcuts` names it: it reaches
 * the bar from inside the app's dialogs and popovers, which a click on the bar would close (R14).
 */
export const PICK_SHORTCUT = "Alt+Shift+P";

/**
 * Whether a key press is the pick shortcut: by its physical key, the same on every layout, and with
 * Option on a Mac, which changes the character it types.
 */
function isPickShortcut(event: KeyboardEvent): boolean {
  return (
    event.code === "KeyP" && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
  );
}

/** A message of the pick script, which at the top of the page posts to the page itself. */
type PickMessage = ({ uraeda: "picked" } & Pick) | { uraeda: "pick-stopped" };

/** The page's colour mode now: see `useColorMode`. */
function colorMode(page: Window): "dark" | "light" {
  const set = page.document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") {
    return set;
  }
  return page.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * The page's colour mode, light or dark: the one the app's theme gave the page, which sets
 * `data-theme` on the root element, else the system's. The bar follows the app instead of keeping a
 * mode of its own, as the app's settings change it while the bar is mounted.
 */
function useColorMode(page: Window): "dark" | "light" {
  const [mode, setMode] = useState(() => colorMode(page));
  useEffect(() => {
    const changed = () => setMode(colorMode(page));
    const system = page.matchMedia("(prefers-color-scheme: dark)");
    const observer = new MutationObserver(changed);
    observer.observe(page.document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });
    system.addEventListener("change", changed);
    changed();
    return () => {
      observer.disconnect();
      system.removeEventListener("change", changed);
    };
  }, [page]);
  return mode;
}

/** Copies a text to the clipboard, and says whether the browser let it. */
async function copy(page: Window, text: string) {
  try {
    await page.navigator.clipboard.writeText(text);
    return true;
  } catch {
    // A page without clipboard access, or a browser that refuses it: the bar shows the text.
    return false;
  }
}

function Picker({ page }: { page: Window }) {
  const [picking, setPicking] = useState(false);
  const [last, setLast] = useState<PickStatus>({ kind: "idle" });
  const mode = useColorMode(page);
  const pick = (on: boolean) => {
    setPicking(on);
    page.postMessage({ on, uraeda: "pick" }, "*");
  };
  // The shortcut's listener reads the mode now, not the one of the render that added it.
  const toggle = useEffectEvent(() => pick(!picking));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPickShortcut(event)) {
        return;
      }
      // Taken before the page's own listeners see it, so a menu's typeahead or a text field gets no
      // key; a held key's repeats toggle nothing.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        toggle();
      }
    };
    page.addEventListener("keydown", onKey, { capture: true });
    return () => page.removeEventListener("keydown", onKey, { capture: true });
  }, [page]);
  useEffect(() => {
    const onMessage = (event: MessageEvent<PickMessage | null>) => {
      // The script posts to the page itself, its parent at the top of the page: a frame's message,
      // like a story's own pick script, is no pick of this page.
      if (event.source !== page) {
        return;
      }
      const message = event.data;
      if (message?.uraeda === "pick-stopped") {
        setPicking(false);
      } else if (message?.uraeda === "picked") {
        setPicking(false);
        const text = pickText(message, {
          address: page.location.href,
          height: page.innerHeight,
          theme: mode,
          width: page.innerWidth,
        });
        void copy(page, text).then((copied) =>
          setLast(
            copied ? { element: elementOf(message), kind: "copied" } : { kind: "failed", text },
          ),
        );
      }
    };
    page.addEventListener("message", onMessage);
    return () => page.removeEventListener("message", onMessage);
  }, [page, mode]);
  return (
    <Theme mode={mode} theme={uraedaTheme}>
      <SandboxBar last={last} onPickingChange={pick} picking={picking} shortcut={PICK_SHORTCUT} />
    </Theme>
  );
}

/** The page's topmost modal dialog, or `null`: the last one open, as later ones open above. */
function topModal(document: Document): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>("dialog:modal");
  return open.item(open.length - 1);
}

/**
 * Keeps the bar's host where it can be seen and used: in the topmost modal dialog while one is open,
 * since a modal dialog makes the rest of the page inert, else at the end of the body. The host is a
 * manual popover, shown again after each move, so it is drawn in the top layer, above the dialog
 * and outside its clipping, and opening it closes none of the app's popovers.
 */
function followModals(document: Document, host: HTMLElement): () => void {
  const place = () => {
    const parent = topModal(document) ?? document.body;
    if (host.parentElement !== parent) {
      parent.append(host);
    }
    if (!host.matches(":popover-open")) {
      host.showPopover();
    }
  };
  const observer = new MutationObserver(place);
  observer.observe(document.documentElement, {
    attributeFilter: ["open"],
    attributes: true,
    childList: true,
    subtree: true,
  });
  place();
  return () => observer.disconnect();
}

/**
 * Mounts the bar in a root of its own, a new element at the end of the page's body, or in the
 * topmost open modal dialog, and returns what removes it.
 */
export function mountSandboxBar({ document, window }: { document: Document; window: Window }) {
  const host = document.createElement("div");
  host.popover = "manual";
  // A popover's own box, which the browser centres and frames: the bar positions itself.
  Object.assign(host.style, {
    background: "none",
    border: "0",
    inset: "auto",
    margin: "0",
    overflow: "visible",
    padding: "0",
  });
  const unfollow = followModals(document, host);
  const root = createRoot(host);
  root.render(<Picker page={window} />);
  return () => {
    unfollow();
    root.unmount();
    host.remove();
  };
}
