// The one key picker of the shell, drawn where `useKeyPicker` opened it. Nothing is read while it
// has never been opened, so no page waits on its records; once opened, it stays mounted, closed,
// so its history entry and its focus return are the picker's own.
import { Suspense, useEffect } from "react";
import { navigateHere } from "../routes.tsx";
import { KeyPicker } from "./KeyPicker.tsx";
import { closePicker, resetPicker, usePickerState } from "./pickerState.ts";
import { type PickerKind, usePickerItems } from "./pickerSources.ts";

/** What the picker is called, and its search field, by the kind it lists. */
const titleOf = (kind: PickerKind | "all") => `Find · ${kind === "all" ? "everything" : kind}`;

function OpenPicker({ isOpen, kind }: { isOpen: boolean; kind: PickerKind | "all" }) {
  const items = usePickerItems(kind);
  return (
    <KeyPicker
      isOpen={isOpen}
      items={items}
      onClose={closePicker}
      onPick={(item) => navigateHere(item.path)}
      showKinds={kind === "all"}
      title={titleOf(kind)}
    />
  );
}

/** Draws the picker the shell's keys opened; mounted once, in the shell. */
export function KeyPickerHost() {
  const { isOpen, kind } = usePickerState();
  // The page it was opened on goes, and the picker with it.
  useEffect(() => resetPicker, []);
  return kind === null ? null : (
    <Suspense fallback={null}>
      <OpenPicker isOpen={isOpen} kind={kind} />
    </Suspense>
  );
}
