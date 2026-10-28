// The inbox's pickers and category keys: `p`'s picker of the drafts to promote a note to, `c`'s
// picker of the categories to move it to, and `C`, `D`, and `R`, which add, delete, and rename a
// category. Each is drawn from its first opening on.
import { type ReactNode, useState } from "react";
import { useDraftTexts, useWorkspace } from "./data.ts";
import { draftFile } from "./draftFile.ts";
import { type Category, itemOf, sectionId } from "./inboxPanes.ts";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import type { PickerItem } from "./keys/pickerSources.ts";
import { useKeys } from "./keys/registry.tsx";
import { useCategoryDelete } from "./lists/CategoryPane.tsx";
import type { useCategoryActions } from "./lists/useCategoryActions.ts";
import { PromotePicker } from "./PromotePicker.tsx";
import type { Placed } from "./useNoteActions.ts";

/** What the category keys act through: the inbox's writes of its categories. */
export type Actions = ReturnType<typeof useCategoryActions>;

/**
 * `p`'s picker, for the note it was opened on, which `start` opens: drawn from its first opening.
 * The drafts' titles are read once `p` is pressed, for "Add to <draft>".
 */
export function usePromote(hash: string, onRefused: (message: string | undefined) => void) {
  const [wantsDrafts, setWantsDrafts] = useState(false);
  const [promoting, setPromoting] = useState<Placed>();
  const [isPromoting, setIsPromoting] = useState(false);
  const paths = (useWorkspace()?.drafts ?? []).map(draftFile);
  const drafts = useDraftTexts(wantsDrafts ? paths : []);
  /** Opens the picker for the note at `placed`. */
  const start = (placed: Placed) => {
    setWantsDrafts(true);
    setPromoting(placed);
    setIsPromoting(true);
  };
  const picker = promoting && (
    <PromotePicker
      drafts={drafts}
      hash={hash}
      isOpen={isPromoting}
      key={promoting.note.id}
      onClose={() => setIsPromoting(false)}
      onRefused={onRefused}
      placed={promoting}
    />
  );
  return { picker, start };
}

/**
 * `c`'s picker of the categories, for the note it was opened on, which `open` opens with the
 * note's section, `from`, and what a pick does: drawn from its first opening.
 */
export function useMovePicker(categories: ReadonlyArray<Category>) {
  const [picking, setPicking] = useState<{ from: string; moveTo: (section: string) => void }>();
  const [isPicking, setIsPicking] = useState(false);
  const choices = categories
    .filter((category) => sectionId(category.name) !== picking?.from)
    .map(itemOf);
  /** Opens the picker for a note in the section `from`. */
  const open = (from: string, moveTo: (section: string) => void) => {
    setPicking({ from, moveTo });
    setIsPicking(true);
  };
  const picker = picking && (
    <KeyPicker
      isOpen={isPicking}
      items={choices}
      onClose={() => setIsPicking(false)}
      onPick={(item) => {
        setIsPicking(false);
        picking.moveTo(item.id);
      }}
      placeholder="Move to a category…"
      title="Move to a category"
    />
  );
  return { open, picker };
}

/**
 * The category keys: `C` calls `onNewCategory`, and `D` and `R` open a picker of the categories,
 * whose pick deletes or renames it, a delete asking in the app's confirmation. `renaming` is the
 * category whose title a pick opened.
 */
export function useCategoryKeys(
  categories: ReadonlyArray<Category>,
  actions: Actions,
  onNewCategory: () => void,
  onRefused: (message: string | undefined) => void,
): { picker: ReactNode; renaming: { count: number; name: string } | undefined } {
  // `R`'s rename, opened in a category's title: each pick counts up, which opens it again.
  const [renaming, setRenaming] = useState<{ count: number; name: string }>();
  // `D` and `R`'s picker of the categories, and what a pick does.
  const [choosing, setChoosing] = useState<"delete" | "rename">("delete");
  const [isChoosing, setIsChoosing] = useState(false);
  // Drawn from its first opening on: the page's focus is its own until then.
  const [isChoiceDrawn, setChoiceDrawn] = useState(false);
  const deleting = useCategoryDelete(actions.remove, onRefused);
  // `D` and `R` act on a category, an empty one too: picked from all of them, by name.
  const named = categories.filter((category) => category.name !== undefined);
  const choose = (kind: "delete" | "rename") => {
    setChoosing(kind);
    setIsChoosing(true);
    setChoiceDrawn(true);
  };
  useKeys([
    // `C` opens the New category line, as a click on it does: first, as it adds one.
    { hint: "C", keys: "C", label: "new category", run: onNewCategory },
    {
      hint: "D",
      hintLabel: "delete category",
      keys: "D",
      label: "delete a category",
      run: () => choose("delete"),
    },
    {
      hint: "R",
      hintLabel: "rename category",
      keys: "R",
      label: "rename a category",
      run: () => choose("rename"),
    },
  ]);
  const chosen = (item: PickerItem) => {
    const category = named.find((one) => sectionId(one.name) === item.id);
    const name = category?.name;
    if (name === undefined) {
      return;
    }
    if (choosing === "delete") {
      void deleting.start(name, category?.notes.length ?? 0);
    } else {
      setRenaming((before) => ({ count: (before?.count ?? 0) + 1, name }));
    }
  };
  const picker = isChoiceDrawn && (
    <KeyPicker
      isOpen={isChoosing}
      items={named.map(itemOf)}
      onClose={() => setIsChoosing(false)}
      onPick={(item) => {
        setIsChoosing(false);
        chosen(item);
      }}
      placeholder={choosing === "rename" ? "Rename a category…" : "Delete a category…"}
      title={choosing === "rename" ? "Rename a category" : "Delete a category"}
    />
  );
  return { picker, renaming };
}
