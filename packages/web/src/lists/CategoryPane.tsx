// The parts of a category's pane: its title, renamed in place; its menu, whose Delete asks what
// becomes of the notes when there are any; and that question, three bordered lines that each show
// their key, which work while it is open and the single-key shortcuts are on.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useEffectEvent, useState } from "react";
import { LineField } from "../EditableLine.tsx";
import { KeyCap } from "../keys/KeyCap.tsx";
import { useSingleKeys } from "../keys/registry.tsx";
import { Overlay, afterOverlayCloses } from "../layout/Overlay.tsx";
import { useLineSave } from "../useLineSave.ts";
import { CardMenu } from "./CardMenu.tsx";
import { plural } from "../labels.ts";

/** What the question's three lines answer. */
export type Answer = "yes" | "no" | "cancel";

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

/** The question's words: "Delete the 3 notes too?", `count` of them. */
function ask(count: number) {
  return `Delete the ${plural(count, "note")} too?`;
}

/**
 * The three answers of the question, by their key, words, and answer, in the order the shared
 * confirmation draws its own: what changes nothing first, what deletes last.
 */
const CHOICES: ReadonlyArray<{ answer: Answer; key: string; words: string }> = [
  { answer: "cancel", key: "c", words: "Cancel" },
  { answer: "no", key: "n", words: "No, keep the notes" },
  { answer: "yes", key: "y", words: "Yes, delete the notes" },
];

/** Each answer's button, as the shared confirmation's: deleting is destructive. */
const VARIANTS: Record<Answer, "destructive" | "secondary"> = {
  cancel: "secondary",
  no: "secondary",
  yes: "destructive",
};

/**
 * Y, N, and C answer while the question is open, whatever has the focus, and while the single-key
 * shortcuts are on: they are letter keys, which the setting stops everywhere (the buttons stay).
 */
function useAnswerKeys(isOpen: boolean, onAnswer: (answer: Answer) => void, singleKeys: boolean) {
  useEffect(() => {
    if (!isOpen || !singleKeys) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const found = CHOICES.find(({ key }) => key.toLowerCase() === event.key.toLowerCase());
      if (!found || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onAnswer(found.answer);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onAnswer, singleKeys]);
}

/**
 * The question of a category's delete: what becomes of its `count` notes. Yes deletes them, No keeps
 * them under no category, and Cancel, Close, Escape, and Back change nothing; Y, N, and C choose.
 * Drawn as the shared confirmation is (`fields/Confirm.tsx`), its third answer between its two.
 */
export function DeleteCategoryDialog({
  count,
  isOpen,
  name,
  onAnswer,
}: {
  count: number;
  isOpen: boolean;
  name: string;
  onAnswer: (answer: Answer) => void;
}) {
  const singleKeys = useSingleKeys();
  useAnswerKeys(isOpen, onAnswer, singleKeys);
  return (
    <Overlay
      isOpen={isOpen}
      label={`Delete the category ${name}`}
      onClose={() => onAnswer("cancel")}
      sheetHeight="hug"
    >
      <VStack gap={3}>
        <Text display="block">{ask(count)}</Text>
        <Text color="secondary" display="block">
          No keeps the notes, in their order, under No category.
        </Text>
        {/* Wrapping, so a long label stays whole rather than cut, as the confirmation's. */}
        <HStack gap={2} justify="end" wrap="wrap">
          {CHOICES.map(({ answer, key, words }) => (
            <Button
              // The focus opens on Cancel, as the confirmation's: Enter changes nothing.
              {...(answer === "cancel" ? { "data-autofocus": "" } : {})}
              endContent={singleKeys ? <KeyCap>{key}</KeyCap> : undefined}
              key={answer}
              label={words}
              onClick={() => onAnswer(answer)}
              variant={VARIANTS[answer]}
            />
          ))}
        </HStack>
      </VStack>
    </Overlay>
  );
}

/**
 * A category's delete, from its menu or a key: with notes it asks first; an empty category goes at
 * once, with its Undo, as there is nothing to ask about. `onRemove` writes the delete, keeping the
 * notes or not, and resolves with the refusal's message to show, if any. Returns what starts it,
 * for a category and its count of notes, and the question, to draw.
 */
export function useCategoryDelete(
  onRemove: (name: string, keepNotes: boolean) => Promise<string | undefined>,
  onRefused: (message: string | undefined) => void,
) {
  const [asking, setAsking] = useState<{ count: number; name: string }>();
  const [isOpen, setOpen] = useState(false);
  const remove = (name: string, keepNotes: boolean) => {
    onRefused(undefined);
    void onRemove(name, keepNotes).then(onRefused);
  };
  const answer = (choice: Answer) => {
    setOpen(false);
    const name = asking?.name;
    if (choice !== "cancel" && name !== undefined) {
      // Once the question's history entry is gone: the page's own Back must not undo what follows.
      afterOverlayCloses(`Delete the category ${name}`, () => remove(name, choice === "no"));
    }
  };
  const start = (name: string, count: number) => {
    if (count === 0) {
      remove(name, false);
    } else {
      setAsking({ count, name });
      setOpen(true);
    }
  };
  const dialog = asking && (
    <DeleteCategoryDialog
      count={asking.count}
      isOpen={isOpen}
      name={asking.name}
      onAnswer={answer}
    />
  );
  return { dialog, start };
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
  const { dialog, start } = useCategoryDelete(onRemove, onRefused);
  return (
    <>
      <CardMenu
        items={[{ label: "Delete", onClick: () => start(name, count), variant: "destructive" }]}
        label={`Actions of category ${name}`}
      />
      {dialog}
    </>
  );
}
