// A list's keys, declared in the key registry where the list is mounted: in the scope of the pane
// that holds it, so they work while that pane has the focus, and never otherwise. A list never
// listens for a key itself.
//
// `j` `k` and the arrows move the cursor, and repeat while held; `g g` and `G`, `Home` and `End`,
// go to the first and the last row (the shell leaves `g g` to lists: Git's place is `g c`); `Enter`
// is the row's own, `open`. With ranges, `J` `K` and Shift with the arrows stretch the selection. A
// move past either end does nothing and says so, so the key goes on to what is past the list: the
// layout shell's `k` to the pane's tabs.
//
// A keyboard-first app shows where the keys go before any is pressed: while the keys work where
// the list is (its pane has the focus), a list with no cursor puts it on its first row, or its last
// for a list that opens at its end (a transcript), without scrolling. A pointer user meets a quiet bar there; a pane at rest keeps its cursor, unlit.
import { effect, untracked } from "nsh";
import { type KeySpec, keysWorkHere, registerKey } from "../keys/registry";
import { besideOpener, offerBeside } from "../layout/here";
import type { PaneRef } from "../layout/layout";
import type { Cursor } from "./cursor";

export type ListKeysOptions = {
  /**
   * The pane a row names, opened beside the list's pane in place of `onOpen`'s navigation: a
   * session's conversation, a file, a diff. `shift+Enter`, and its pane's menu, "Open … beside".
   */
  beside?: (id: string) => PaneRef | undefined;
  /** The row's own action, run by `Enter`: open it, follow it. */
  onOpen?: (id: string) => void;
  /** What `Enter` says in the key map: "open" unless given. */
  openLabel?: string;
  /** Whether the keys are on beside the scope's own: off while the list is hidden. */
  when?: () => boolean;
  /** The row the cursor starts on while it has none: the first, or the last for a transcript. */
  start?: "first" | "last";
};

/** What a key's `run` answers: nothing when it did something, `false` to pass the key on. */
const did = (done: boolean): false | undefined => (done ? undefined : false);

export function listKeys(cursor: Cursor, options: ListKeysOptions = {}) {
  const when = options.when;
  const works = keysWorkHere();
  effect(() => {
    const items = cursor.items();
    const first = options.start === "last" ? items.at(-1) : items[0];
    if (first !== undefined && cursor.at() === undefined && works() && (when?.() ?? true)) {
      untracked(() => cursor.set(first.id));
    }
  });
  const keys: Array<KeySpec> = [
    {
      keys: "j",
      label: "next row",
      hint: "j k",
      hintLabel: "move",
      repeat: true,
      run: () => did(cursor.move(1)),
      when,
    },
    { keys: "k", label: "previous row", repeat: true, run: () => did(cursor.move(-1)), when },
    { keys: "ArrowDown", label: "next row", repeat: true, run: () => did(cursor.move(1)), when },
    { keys: "ArrowUp", label: "previous row", repeat: true, run: () => did(cursor.move(-1)), when },
    { keys: "g g", label: "first row", run: () => did(cursor.to("first")), when },
    { keys: "G", label: "last row", run: () => did(cursor.to("last")), when },
    { keys: "Home", label: "first row", run: () => did(cursor.to("first")), when },
    { keys: "End", label: "last row", run: () => did(cursor.to("last")), when },
  ];
  if (options.onOpen !== undefined) {
    const open = options.onOpen;
    keys.push({
      keys: "Enter",
      label: options.openLabel ?? "open",
      run: () => {
        const id = cursor.at();
        if (id === undefined) {
          return false;
        }
        open(id);
        return undefined;
      },
      when,
    });
  }
  if (options.beside !== undefined) {
    const named = options.beside;
    const open = besideOpener();
    const atCursor = () => {
      const id = cursor.at();
      return id === undefined ? undefined : named(id);
    };
    offerBeside(() => {
      const pane = atCursor();
      return pane === undefined ? undefined : { open: () => open(pane), pane };
    });
    keys.push({
      keys: "shift+Enter",
      label: "open beside",
      run: () => {
        const pane = atCursor();
        if (pane === undefined) {
          return false;
        }
        open(pane);
        return undefined;
      },
      when,
    });
  }
  if (cursor.ranges) {
    const stretch = (by: number) => () => did(cursor.move(by, true));
    keys.push(
      { keys: "J", label: "stretch down", repeat: true, run: stretch(1), when },
      { keys: "K", label: "stretch up", repeat: true, run: stretch(-1), when },
      { keys: "shift+ArrowDown", label: "stretch down", repeat: true, run: stretch(1), when },
      { keys: "shift+ArrowUp", label: "stretch up", repeat: true, run: stretch(-1), when },
    );
  }
  registerKey(keys);
}
