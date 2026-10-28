// The parts of a category's pane: its title, renamed in place; its menu, whose Delete asks what
// becomes of the notes when there are any; and that question, three bordered lines that each show
// their key, which work while it is open and the single-key shortcuts are on.
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useEffectEvent, useState } from "react";
import { LineField } from "../EditableLine.tsx";
import { useSingleKeys } from "../keys/registry.tsx";
import { Overlay, afterOverlayCloses } from "../layout/Overlay.tsx";
import { useLineSave } from "../useLineSave.ts";
import { CardMenu } from "./CardMenu.tsx";
import { plural } from "../labels.ts";

/** What the question's three lines answer. */
export type Answer = "yes" | "no" | "cancel";

const styles = stylex.create({
  // A choice: a bordered line, its words at the start and its key at the end.
  choice: {
    alignItems: "center",
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
  },
  // The key, a bordered mark of its own, as a terminal draws one.
  key: {
    // Against the line's end, past its words.
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    color: colorVars["--color-text-accent"],
    font: "inherit",
    marginInlineStart: "auto",
    paddingInline: spacingVars["--spacing-2"],
  },
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

/** The three lines of the question, by their key, words, and answer. */
const CHOICES: ReadonlyArray<{ answer: Answer; key: string; words: string }> = [
  { answer: "yes", key: "Y", words: "Yes, delete the notes" },
  { answer: "no", key: "N", words: "No, keep the notes" },
  { answer: "cancel", key: "C", words: "Cancel" },
];

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
        <VStack gap={2}>
          {CHOICES.map(({ answer, key, words }) => (
            <Button
              endContent={singleKeys ? <kbd {...stylex.props(styles.key)}>{key}</kbd> : undefined}
              key={answer}
              label={words}
              onClick={() => onAnswer(answer)}
              variant="ghost"
              width="100%"
              xstyle={styles.choice}
            />
          ))}
        </VStack>
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
