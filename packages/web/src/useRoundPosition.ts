import { useEffect, useLayoutEffect, useRef } from "react";
import { currentEntry } from "./routes.tsx";
import { jumpTo, type NavQuestion, questionAtTop } from "./RoundNav.tsx";

function read(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    // No storage, as in a private window: the round opens as on a new browser.
    return undefined;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // No storage: the position is not kept.
  }
}

/**
 * Where a round opens, and where it is kept on this browser: the id of the question at the top,
 * saved in `localStorage` at most once a second while the page scrolls. Opened anew, not by Back
 * or a reload (whose history entry holds its own position), the round goes to the saved question
 * when it still applies, else to the first blank question, else stays at its top.
 */
export function useRoundPosition(
  folder: string,
  file: string,
  questions: ReadonlyArray<NavQuestion>,
) {
  const key = `uraeda.round.${folder}/${file}`;
  const ids = useRef<ReadonlyArray<string>>([]);
  ids.current = questions.map((q) => q.id);

  useLayoutEffect(() => {
    if (typeof currentEntry().scroll === "number") {
      return;
    }
    const saved = read(key);
    const target =
      saved && ids.current.includes(saved) ? saved : questions.find((q) => !q.answered)?.id;
    if (target) {
      jumpTo(target, true);
    }
    // Once, when the round is drawn.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      const at = questionAtTop(ids.current);
      if (at) {
        write(key, at);
      }
    };
    const onScroll = () => {
      timer ??= setTimeout(save, 1000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [key]);
}
