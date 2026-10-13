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
  // Read, not followed: answering a question moves no one.
  const ids = useRef<ReadonlyArray<string>>([]);
  ids.current = questions.map((q) => q.id);
  const firstBlank = useRef<string>(undefined);
  firstBlank.current = questions.find((q) => !q.answered)?.id;

  // Once per round, when it is drawn.
  useLayoutEffect(() => {
    if (typeof currentEntry().scroll === "number") {
      return;
    }
    const saved = read(key);
    const target = saved && ids.current.includes(saved) ? saved : firstBlank.current;
    if (target) {
      jumpTo(target, true);
    }
  }, [key]);

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
