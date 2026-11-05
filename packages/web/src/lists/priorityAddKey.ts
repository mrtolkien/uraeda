// The priorities' `a`: the add form in the section of the row the keys act on.
import { useRef } from "react";
import { useKeys } from "../keys/registry.tsx";
import { TITLES } from "../QuickAdd.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { spotOfRow } from "./outline.ts";
import type { WorkSection } from "./WorkList.tsx";

/**
 * The file's section of the row `key` among `sections`: its own place's, so that a running line in
 * "Ongoing" or a nested row is its line's section, and an Add row its section's.
 */
export function sectionOfRow(sections: ReadonlyArray<WorkSection>, key: string) {
  const rows = sections.flatMap((section) =>
    section.rows.flatMap((row) => [row, ...(row.children ?? [])]),
  );
  const row = rows.find((one) => one.key === key);
  return row && spotOfRow(row)?.section;
}

/**
 * `a`, the ＋ next to Priorities from the keyboard: the add form in the section of the row the keys
 * act on, the focused one or the one selected, when the form has that section, as "Add to Now" or
 * a line of Now opens it on Now; with none, or a Blocked one, in its default place, Next. Not named
 * in the status line. Returns what the list's `onSelected` calls.
 */
export function useAddKey(sections: ReadonlyArray<WorkSection>) {
  const openForm = useOpenAddForm();
  const selected = useRef<string>(undefined);
  useKeys([
    {
      icon: "plus",
      keys: "a",
      label: "add",
      run: (event) => {
        // The row whose link has the focus, as the list's own keys act on, else the one selected.
        const target = event.target as Partial<Element> | null;
        const key =
          target?.closest?.("[data-row]")?.getAttribute("data-row-key") ?? selected.current;
        const section = key === undefined ? undefined : sectionOfRow(sections, key);
        openForm("proposal", section !== undefined && TITLES.has(section) ? { section } : {});
      },
    },
  ]);
  return (key: string | undefined) => {
    selected.current = key;
  };
}
