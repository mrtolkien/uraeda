// The sandbox's picker: it mounts the bar in a root of its own, beside the app's, runs pick mode
// through the skill's pick script, which the page loads at its top, and copies each pick. The app's
// own entry knows nothing of it. Only the sandbox's page loads it.
import { Theme } from "@astryxdesign/core/theme";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { elementOf, type Pick, pickText } from "./pickText.ts";
import { type PickStatus, SandboxBar } from "./SandboxBar.tsx";

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
      <SandboxBar
        last={last}
        onPickingChange={(on) => {
          setPicking(on);
          page.postMessage({ on, uraeda: "pick" }, "*");
        }}
        picking={picking}
      />
    </Theme>
  );
}

/**
 * Mounts the bar in a root of its own, a new element at the end of the page's body, and returns what
 * removes it.
 */
export function mountSandboxBar({ document, window }: { document: Document; window: Window }) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(<Picker page={window} />);
  return () => {
    root.unmount();
    host.remove();
  };
}
