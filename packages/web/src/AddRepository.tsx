// The add form: one field, Folder, completing the folders of the server's machine as it is typed,
// in an overlay from the repository menu, or in the page on the first run.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { useFolderSuggestions } from "./data.ts";
import { refusal } from "./errors.ts";
import { arrowKeys, TextLine } from "./fields/TextLine.tsx";
import { navigate, repoPath } from "./routes.tsx";
import { RepositoriesView } from "./views.ts";

const styles = stylex.create({
  // On the first run, the form as wide as a dialog's, not the page's column.
  inline: {
    maxWidth: "var(--size-form)",
  },
  // A path wraps anywhere rather than be cut, so it reads whole on the phone.
  path: {
    overflowWrap: "anywhere",
  },
});

/** Where the field starts: the home folder, whose folders the human goes on from. */
const START = "~/";

/** The same folder, with or without its trailing slash. */
const sameFolder = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

/**
 * The folders starting with the text, those in git marked, each filling the field when picked;
 * `active` is the one the arrows are on. `onShown` is told the paths drawn, for the field's keys.
 */
function Suggestions({
  active,
  onPick,
  onShown,
  text,
}: {
  active: number;
  onPick: (path: string) => void;
  onShown: (paths: ReadonlyArray<string>) => void;
  text: string;
}) {
  const rows = useFolderSuggestions(text);
  useEffect(() => {
    onShown(rows.map((row) => row.path));
    return () => onShown([]);
  }, [onShown, rows]);
  if (rows.length === 0) {
    return null;
  }
  return (
    <List aria-label="Folders" density="compact">
      {rows.map((row, index) => (
        <ListItem
          endContent={row.git ? <Badge label="git" variant="neutral" /> : undefined}
          isSelected={index === active}
          key={row.path}
          label={<span {...stylex.props(styles.path)}>{row.path}</span>}
          onClick={() => onPick(row.path)}
        />
      ))}
    </List>
  );
}

/**
 * The field's text, its error, and its suggestions: those drawn (`onShown`), the one Down and Up
 * are on (`move`), and whether one filled the field (`fill`). `picked` is the suggestion Enter fills
 * the field with: the one the arrows are on, or the only one, unless one filled it already.
 */
function useFolderText() {
  const [text, setText] = useState(START);
  const [error, setError] = useState<string>();
  // Suggestions show once the human types, the earlier ones kept while the next ones load.
  const [typed, setTyped] = useState(false);
  const suggested = useRef<ReadonlyArray<string>>([]);
  const [onShown] = useState(() => (paths: ReadonlyArray<string>) => {
    suggested.current = paths;
  });
  const [active, setActive] = useState(-1);
  // Whether a suggestion filled the field: the next Enter adds it, whatever loads meanwhile.
  const filled = useRef(false);

  const change = (value: string) => {
    filled.current = false;
    setText(value);
    setTyped(true);
    setError(undefined);
    setActive(-1);
  };
  return {
    active,
    change,
    error,
    fill: (value: string) => {
      change(value);
      filled.current = true;
    },
    move: (step: number) => {
      filled.current = false;
      setActive(Math.max(-1, Math.min(suggested.current.length - 1, active + step)));
    },
    onShown,
    picked: () => {
      const rows = suggested.current;
      return filled.current
        ? undefined
        : (rows[active] ?? (rows.length === 1 ? rows[0] : undefined));
    },
    setError,
    text,
    typed,
  };
}

/**
 * Adds the git repository holding a typed folder, and opens it: `onAdded` is given its name, or,
 * without it, its home opens at once. Its error, under the field, stays until the text changes.
 * `onCancel` adds Cancel beside Add. List mutations go through the client in context, the global
 * one: the repository gate reads the list there.
 */
export function AddRepository({
  inline = false,
  onAdded,
  onCancel,
}: {
  inline?: boolean;
  onAdded?: (name: string) => void;
  onCancel?: () => void;
}) {
  const fate = useFateClient();
  const { active, change, error, fill, move, onShown, picked, setError, text, typed } =
    useFolderText();
  const shown = useDeferredValue(text);

  const add = async () => {
    setError(undefined);
    const { error, result } = await fate.mutations.repositories.add({
      input: { folder: text },
      view: RepositoriesView,
    });
    if (error || !result?.added) {
      setError(refusal(error).message);
      return;
    }
    if (onAdded) {
      onAdded(result.added);
    } else {
      navigate(repoPath(result.added, "/"));
    }
  };

  return (
    <VStack gap={3} xstyle={inline && styles.inline}>
      <TextLine
        hasAutoFocus={!inline}
        keys={arrowKeys(move)}
        label="Folder"
        onChange={change}
        onEnter={() => {
          const pick = picked();
          if (pick !== undefined && !sameFolder(pick, text)) {
            fill(pick);
          } else {
            void add();
          }
        }}
        status={error ? { message: error, type: "error" } : undefined}
        value={text}
      />
      {typed && /^[/~]/.test(shown) && (
        <Suspense fallback={null}>
          <Suggestions active={active} onPick={fill} onShown={onShown} text={shown} />
        </Suspense>
      )}
      <Text color="secondary" type="supporting">
        A folder in a git repository. From a terminal: <Code size="inherit">ura add</Code>
      </Text>
      <HStack gap={2} justify={inline ? "start" : "end"}>
        {onCancel && <Button label="Cancel" onClick={onCancel} />}
        <Button clickAction={add} label="Add" variant="primary" />
      </HStack>
    </VStack>
  );
}
