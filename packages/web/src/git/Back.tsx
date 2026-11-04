// The phone's Back from the Git page's detail, a diff, a commit, or a conflicted file, to the page it
// was opened from: the browser's Back when that was the Git page, so the sections come back where
// they were scrolled, else the sections afresh.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { useEffect, useRef } from "react";
import { currentEntry, navigateHere, updateEntry, useEntryId, useSearch } from "../routes.tsx";
import { GIT_PATH, gitAddress } from "./address.ts";

/**
 * Names, in each history entry the page opens while it is drawn, the Git page's address it was
 * opened from, as its `from`: an entry the page was opened on, from another page, has none.
 */
export function useOpenedFromGit() {
  const id = useEntryId();
  const search = useSearch();
  const opened = useRef(id);
  const last = useRef<string>(undefined);
  useEffect(() => {
    if (id !== opened.current && last.current !== undefined && currentEntry().from === undefined) {
      updateEntry({ from: last.current });
    }
    last.current = `${GIT_PATH}${search}`;
  }, [id, search]);
}

/** Back to the sections, or to the detail before, as the browser's Back when it stays on the page. */
function back() {
  if (currentEntry().from?.startsWith(GIT_PATH)) {
    window.history.back();
  } else {
    navigateHere(gitAddress());
  }
}

/** The phone's way back from the detail; none on wider screens, where the sections stay beside. */
export function Back({ isNarrow }: { isNarrow: boolean }) {
  return isNarrow ? (
    <Button icon={<Icon icon="arrowLeft" />} label="Back" onClick={back} variant="ghost" />
  ) : null;
}
