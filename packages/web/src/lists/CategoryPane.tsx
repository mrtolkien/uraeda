// The parts of a category's pane: its title, renamed in place; and its delete, a button in the
// pane's border, which asks what becomes of the notes when there are any, in the app's one
// confirmation (`fields/Confirm.tsx`), with a third answer.
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useEffectEvent } from "react";
import { LineField } from "../EditableLine.tsx";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { useLineSave } from "../useLineSave.ts";
import { plural } from "../labels.ts";
import { paneVars } from "../layout/pane.stylex.ts";

const styles = stylex.create({
  // The title, a button drawn as the title it stands for: a target as tall as a control, the
  // theme's 44 px on a touch screen, around its line, its padding taking no room from the title (as
  // a folding pane's title does: a pixel over the control's height, so a fractional line cannot
  // round it under).
  title: {
    alignItems: "center",
    display: "inline-flex",
    fontWeight: "inherit",
    marginBlock: `calc((1lh - ${paneVars["--pane-title-slack"]} - ${sizeVars["--size-element-sm"]}) / 2)`,
    paddingBlock: `calc((${sizeVars["--size-element-sm"]} + ${paneVars["--pane-title-slack"]} - 1lh) / 2)`,
  },
});

/**
 * A category's title, renamed in place: a button that opens a field, where Enter saves and Escape
 * cancels (see `useLineSave`). `onRename` resolves with the refusal's message, which shows under the
 * field, or with nothing once written. Each new `opens` above 0 opens the field, as a key does.
 */
export function CategoryTitle({
  name,
  onRename,
  opens = 0,
}: {
  name: string;
  onRename: (from: string, to: string) => Promise<string | undefined>;
  opens?: number;
}) {
  const line = useLineSave({
    empty: "A category needs a name.",
    field: `inbox#category:${name}`,
    onSave: (to) => onRename(name, to),
    stayOpen: false,
    value: name,
  });
  const openLine = useEffectEvent(line.openLine);
  useEffect(() => {
    if (opens > 0) {
      openLine();
    }
  }, [opens]);
  if (line.open) {
    return <LineField isBare label={`Rename ${name}`} line={line} />;
  }
  return (
    <Link color="primary" onClick={line.openLine} type="inherit" xstyle={styles.title}>
      {name}
    </Link>
  );
}

/**
 * What a category's delete asks, `name` holding `count` notes: Yes, `y`, deletes them, and the note
 * files `files` they link, which it names; No, `n`, keeps them under no category; Cancel, `c`,
 * Close, Escape, and Back change nothing.
 */
export function deleteCategory(
  name: string,
  count: number,
  files: ReadonlyArray<string> = [],
): ConfirmOptions<"keep"> {
  const keeps = "No keeps the notes, in their order, under No category.";
  return {
    answers: [{ key: "n", label: "No, keep the notes", value: "keep" }],
    body: `Delete the ${plural(count, "note")} too?`,
    cancel: "Cancel",
    cancelKey: "c",
    confirm: "Yes, delete the notes",
    destructive: true,
    detail:
      files.length === 0
        ? keeps
        : `Yes deletes their ${files.length === 1 ? "note file" : "note files"} too: ${files.join(", ")}. ${keeps}`,
    title: `Delete the category ${name}`,
  };
}

/**
 * A category's delete, from its button or a key: with notes it asks first (`deleteCategory`); an
 * empty category goes at once, with its Undo, as there is nothing to ask about. `onRemove` writes
 * the delete, keeping the notes or not, and resolves with the refusal's message to show, if any.
 * Returns what starts it, for a category, its count of notes, and the note files they link.
 */
export function useCategoryDelete(
  onRemove: (name: string, keepNotes: boolean) => Promise<string | undefined>,
  onRefused: (message: string | undefined) => void,
) {
  const confirm = useConfirm();
  const remove = (name: string, keepNotes: boolean) => {
    onRefused(undefined);
    void onRemove(name, keepNotes).then(onRefused);
  };
  // The answer comes once the question's history entry is gone: the page's own Back must not undo
  // what follows.
  const start = async (name: string, count: number, files: ReadonlyArray<string> = []) => {
    const answer = count === 0 ? true : await confirm(deleteCategory(name, count, files));
    if (answer !== false) {
      remove(name, answer === "keep");
    }
  };
  return { start };
}

/**
 * A category's delete, in its pane's border: its icon, named for screen readers and in its tooltip,
 * a target for the mouse and touch beside the `D` key (see `useCategoryDelete`).
 */
export function DeleteCategoryButton({
  count,
  files,
  name,
  onRefused,
  onRemove,
}: {
  count: number;
  /** The note files its notes link, which a delete of its notes takes with them. */
  files: ReadonlyArray<string>;
  name: string;
  onRefused: (message: string | undefined) => void;
  onRemove: (name: string, keepNotes: boolean) => Promise<string | undefined>;
}) {
  const { start } = useCategoryDelete(onRemove, onRefused);
  return (
    <Button
      icon={<Icon icon="uraeda:trash" />}
      isIconOnly
      label={`Delete category ${name}`}
      onClick={() => void start(name, count, files)}
      size="sm"
      tooltip="Delete category"
      variant="ghost"
    />
  );
}
