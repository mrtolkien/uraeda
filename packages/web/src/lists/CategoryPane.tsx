// The parts of a category's pane: its title, renamed in place; its menu, whose Delete asks what
// becomes of the notes when there are any, in the app's one confirmation (`fields/Confirm.tsx`),
// with a third answer.
import { Link } from "@astryxdesign/core/Link";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useEffectEvent } from "react";
import { LineField } from "../EditableLine.tsx";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { useLineSave } from "../useLineSave.ts";
import { CardMenu } from "./CardMenu.tsx";
import { plural } from "../labels.ts";

const styles = stylex.create({
  // The title, a button drawn as the title it stands for: a target as tall as a control, the
  // theme's 44 px on a touch screen, around its line, its padding taking no room from the title (as
  // a folding pane's title does: a pixel over the control's height, so a fractional line cannot
  // round it under).
  title: {
    alignItems: "center",
    display: "inline-flex",
    fontWeight: "inherit",
    marginBlock: `calc((1lh - 1px - ${sizeVars["--size-element-sm"]}) / 2)`,
    paddingBlock: `calc((${sizeVars["--size-element-sm"]} + 1px - 1lh) / 2)`,
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
 * What a category's delete asks, `name` holding `count` notes: Yes, `y`, deletes them; No, `n`,
 * keeps them under no category; Cancel, `c`, Close, Escape, and Back change nothing.
 */
export function deleteCategory(name: string, count: number): ConfirmOptions<"keep"> {
  return {
    answers: [{ key: "n", label: "No, keep the notes", value: "keep" }],
    body: `Delete the ${plural(count, "note")} too?`,
    cancel: "Cancel",
    cancelKey: "c",
    confirm: "Yes, delete the notes",
    destructive: true,
    detail: "No keeps the notes, in their order, under No category.",
    title: `Delete the category ${name}`,
  };
}

/**
 * A category's delete, from its menu or a key: with notes it asks first (`deleteCategory`); an
 * empty category goes at once, with its Undo, as there is nothing to ask about. `onRemove` writes
 * the delete, keeping the notes or not, and resolves with the refusal's message to show, if any.
 * Returns what starts it, for a category and its count of notes.
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
  const start = async (name: string, count: number) => {
    const answer = count === 0 ? true : await confirm(deleteCategory(name, count));
    if (answer !== false) {
      remove(name, answer === "keep");
    }
  };
  return { start };
}

/** A category's menu, in its pane's border: Delete (see `useCategoryDelete`). */
export function CategoryMenu({
  count,
  name,
  onRefused,
  onRemove,
}: {
  count: number;
  name: string;
  onRefused: (message: string | undefined) => void;
  onRemove: (name: string, keepNotes: boolean) => Promise<string | undefined>;
}) {
  const { start } = useCategoryDelete(onRemove, onRefused);
  return (
    <CardMenu
      items={[{ label: "Delete", onClick: () => void start(name, count), variant: "destructive" }]}
      label={`Actions of category ${name}`}
    />
  );
}
