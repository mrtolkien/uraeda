// The add form: one field, Folder, completing the folders of the server's machine as it is typed,
// in an overlay from the repository menu, or in the page on the first run.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { useFolderSuggestions } from "./data.ts";
import { refusal } from "./errors.ts";
import { navigate, repoPath } from "./routes.tsx";
import { RepositoriesView } from "./views.ts";

const styles = stylex.create({
  // On the first run, the form as wide as a dialog's, not the page's column.
  inline: {
    maxWidth: "var(--size-form)",
  },
  // A path wraps anywhere rather than be cut: the UI checks decision cuts no text.
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
  const [text, setText] = useState(START);
  const [error, setError] = useState<string>();
  // Suggestions show once the human types, the earlier ones kept while the next ones load.
  const [typed, setTyped] = useState(false);
  const shown = useDeferredValue(text);
  // The suggestions drawn, and the one Down and Up are on, which Enter picks.
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

  const fill = (value: string) => {
    change(value);
    filled.current = true;
  };

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
      <TextInput
        hasAutoFocus={!inline}
        label="Folder"
        onChange={change}
        onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
          const rows = suggested.current;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            filled.current = false;
            setActive(Math.max(-1, Math.min(rows.length - 1, active + step)));
          } else if (event.key === "Enter") {
            event.preventDefault();
            // The suggestion the arrows are on, or the only one, fills the field; then Enter adds.
            const picked = filled.current
              ? undefined
              : (rows[active] ?? (rows.length === 1 ? rows[0] : undefined));
            if (picked !== undefined && !sameFolder(picked, text)) {
              fill(picked);
            } else {
              void add();
            }
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
