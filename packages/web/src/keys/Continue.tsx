// Continue, `Space c`: open what needs the human. One card opens at once, several open a small
// picker of them whose Enter opens the selected, and none says so: the entry in the menu reads
// "Nothing needs you" and a toast says it to a key typed fast. The cards are the shell's Needs you
// pane's, through the selection the status line counts (`needsYouEntries`), never a copy.
import { useToast } from "@astryxdesign/core/Toast";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { navigateHere, sessionIdPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { statusPath, stepOf } from "../sidebar/cards.ts";
import { type Entry, needsYouEntries } from "../sidebar/entries.ts";
import { KeyPicker } from "./KeyPicker.tsx";
import type { PickerItem } from "./pickerSources.ts";
import type { Binding } from "./store.ts";

/** What the entry and the toast say while nothing needs the human. */
export const NOTHING = "Nothing needs you";

/** A card as the picker lists it: where it opens is what its status asks of the human. */
function itemOf(entry: Entry): PickerItem {
  if (entry.kind === "session") {
    const path = sessionIdPath(entry.row.id);
    return {
      icon: "uraeda:activity",
      id: path,
      kind: "sessions",
      path,
      preview: [entry.row.title, entry.status.label].join("\n"),
      title: entry.row.title,
    };
  }
  const { feature } = entry;
  const isChange = feature.kind === "change";
  return {
    icon: isChange ? "wrench" : "uraeda:step-proposal",
    id: `/f/${encodeURIComponent(feature.folder)}`,
    kind: isChange ? "changes" : "features",
    path: statusPath(feature, entry.status),
    preview: [feature.title, stepOf(feature).label, entry.status.label].join("\n"),
    title: feature.title,
  };
}

/** The `Space c` binding, and the picker it opens, for the caller to draw. */
export function useContinue(): { binding: Binding; picker: ReactNode } {
  const items = needsYouEntries(useNavigation()).map(itemOf);
  const showToast = useToast();
  const [isOpen, setOpen] = useState(false);
  // Drawn from its first opening on: the page's focus is its own until then.
  const [isDrawn, setDrawn] = useState(false);
  // A pick opens its page once the picker is closed, as the key picker does (R33).
  const picked = useRef<string>(undefined);
  useEffect(() => {
    if (!isOpen && picked.current !== undefined) {
      const path = picked.current;
      picked.current = undefined;
      navigateHere(path);
    }
  }, [isOpen]);

  const binding: Binding = {
    icon: "uraeda:arrow-right",
    keys: "space c",
    label: items.length === 0 ? NOTHING : "Continue",
    run: () => {
      if (items.length === 0) {
        showToast({ autoHideDuration: 4000, body: NOTHING });
      } else if (items.length === 1) {
        navigateHere(items[0]!.path);
      } else {
        setDrawn(true);
        setOpen(true);
      }
    },
  };
  const picker = isDrawn && (
    <KeyPicker
      isOpen={isOpen}
      items={items}
      onClose={() => setOpen(false)}
      onPick={(item) => {
        picked.current = item.path;
        setOpen(false);
      }}
      showKinds
      title="Continue"
    />
  );
  return { binding, picker };
}
