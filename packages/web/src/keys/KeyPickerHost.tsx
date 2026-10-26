// The one key picker of the shell, drawn where `useKeyPicker` opened it. Nothing is read while it
// has never been opened, so no page waits on its records; once opened, it stays mounted, closed,
// so its history entry and its focus return are the picker's own. Its dialog shows at once,
// "Loading…" until its records are read, and a read that fails closes it with a toast: the read
// never suspends, so neither a wait nor an error takes the page with it.
import { useToast } from "@astryxdesign/core/Toast";
import { useEffect, useEffectEvent, useRef } from "react";
import { navigateHere } from "../routes.tsx";
import { KeyPicker } from "./KeyPicker.tsx";
import { closePicker, resetPicker, usePickerState } from "./pickerState.ts";
import { type PickerKind, usePickerItems } from "./pickerSources.ts";

/** What the picker is called, and its search field: "Find decisions", "Find anything". */
const titleOf = (kind: PickerKind | "all") => `Find ${kind === "all" ? "anything" : kind}`;

/** What the toast says when the records could not be read. */
const FAILED = "Could not load the list to search.";

/** Draws the picker the shell's keys opened; mounted once, in the shell. */
export function KeyPickerHost() {
  const { isOpen, kind, opening } = usePickerState();
  const showToast = useToast();
  // The page it was opened on goes, and the picker with it.
  useEffect(() => resetPicker, []);
  const read = usePickerItems(kind ?? "all", kind !== null);

  // A read that failed closes the picker, once for each failure: the error stays until it is read
  // again, which an opening does.
  const reported = useRef<unknown>(undefined);
  useEffect(() => {
    if (read.error != null && read.error !== reported.current) {
      reported.current = read.error;
      closePicker();
      showToast({ autoHideDuration: 8000, body: FAILED });
    }
  }, [read.error, showToast]);
  const readAgain = useEffectEvent(() => {
    if (read.error != null) {
      read.refetch().catch(() => {});
    }
  });
  useEffect(() => {
    if (opening > 0) {
      readAgain();
    }
  }, [opening]);

  // A pick opens its page once the picker is closed: the dialog hands the focus back to its opener
  // as it closes, which the page just opened would otherwise find taken from it.
  const picked = useRef<string>(undefined);
  useEffect(() => {
    if (!isOpen && picked.current !== undefined) {
      const path = picked.current;
      picked.current = undefined;
      navigateHere(path);
    }
  }, [isOpen]);

  return kind === null ? null : (
    <KeyPicker
      isLoading={!read.isReady}
      isOpen={isOpen}
      items={read.items}
      onClose={closePicker}
      onPick={(item) => {
        picked.current = item.path;
        closePicker();
      }}
      showKinds={kind === "all"}
      title={titleOf(kind)}
    />
  );
}
