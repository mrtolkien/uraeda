import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { currentEntry, useRepository } from "./routes.tsx";
import { jumpTo, type NavQuestion, questionAtTop } from "./roundJump.ts";

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
 * Where a round opens: at a question, `at`, by its id, or at its top; `kept`, at a place of its
 * own, by Back or a reload (whose history entry holds its position), or at the part its address
 * names.
 */
export type RoundOpens = { at?: string | undefined; kept: boolean };

/** Where the round of `key` opens, with `questions`, the applicable ones, in the page's order. */
function opensAt(key: string, questions: ReadonlyArray<NavQuestion>): RoundOpens {
  if (typeof currentEntry().scroll === "number") {
    return { kept: true };
  }
  const saved = read(key);
  const at = saved && questions.some((q) => q.id === saved) ? saved : undefined;
  const blank = questions.some((q) => q.answered)
    ? questions.find((q) => !q.answered)?.id
    : undefined;
  return { at: at ?? blank, kept: window.location.hash !== "" };
}

/**
 * Where a round opens, and where it is kept on this browser, for its repository: the id of the
 * question at the top, saved in `localStorage` at most once a second while the page scrolls.
 * Opened anew, not by Back or a reload (whose history entry holds its own position), the round
 * goes to the saved question when it still applies, else to the first blank question once one is
 * answered, else stays at its top: a round not started opens on its intro. Returns where it opens,
 * read once, as the page is drawn.
 */
export function useRoundPosition(
  folder: string,
  file: string,
  questions: ReadonlyArray<NavQuestion>,
): RoundOpens {
  const key = `uraeda.round.${useRepository()}/${folder}/${file}`;
  // Read, not followed: answering a question moves no one.
  const ids = useRef<ReadonlyArray<string>>([]);
  // oxlint-disable-next-line react/refs -- before the code quality decision: the latest questions, kept for the effects to read
  ids.current = questions.map((q) => q.id);

  // Once per round, as it is first drawn.
  const opening = () => ({ key, ...opensAt(key, questions) });
  const [opens, setOpens] = useState(opening);
  if (opens.key !== key) {
    setOpens(opening());
  }
  useLayoutEffect(() => {
    if (opens.at) {
      jumpTo(opens.at, true, true);
    }
  }, [opens]);

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
  return { at: opens.at, kept: opens.kept };
}
