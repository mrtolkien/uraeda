// What holds the keys for the whole app, mounted once, around it: it hears the keys, draws the
// leader's menu while a sequence waits, and owns the key map, with the keys that open it, `?` and
// `Space ?`. The rest of the leader's tree, the places, Find, New, and the UI's keys, is declared
// where its actions are.
import { effect, type JSX, signal, untracked } from "nsh";
import { KEY_MAP_TITLE, KeyMap } from "./KeyMap";
import { keyMapSections, type KeySection } from "./keyMapSections";
import { LeaderMenuHost } from "./LeaderMenu";
import {
  endKeys,
  keysOn,
  keysRefused,
  listenKeys,
  registerKey,
  singleKeys,
  spaceIsKept,
} from "./registry";

/**
 * Hears the keys while it is mounted. `place` is where the human is, as the page's address: a
 * sequence that waited ends when it changes.
 */
export function KeysHost(props: { children?: JSX.Element; place?: unknown }) {
  listenKeys();
  effect(() => {
    void props.place;
    untracked(endKeys);
  });

  // The keys of where the focus is as the map opens: under its own layer they would be gone.
  const sections = signal<ReadonlyArray<KeySection>>([]);
  const isOpen = signal(false);
  const open = () => {
    sections.set(
      keyMapSections(
        keysOn(),
        { keepsSpace: spaceIsKept(), singleKeys: singleKeys() },
        keysRefused(),
      ),
    );
    isOpen.set(true);
  };
  const label = `${KEY_MAP_TITLE}…`;
  registerKey([
    // Second in the status line, after the menu: "? keys".
    { hint: "?", hintLabel: "keys", icon: "keyboard", keys: "?", label, run: open },
    // The same from the menu, which the chord opens with the single keys off.
    { icon: "keyboard", keys: "space ?", label, run: open },
  ]);

  // The app, made once: `{props.children}` is an expression that makes them again whenever a
  // value they read as they are made changes, a branch shown or a list's rows, and here that was
  // the whole app, every page and the frame, at each message of the server (ruling R413).
  const children = props.children;
  return (
    <>
      {children}
      <LeaderMenuHost />
      <KeyMap onClose={() => isOpen.set(false)} open={isOpen()} sections={sections()} />
    </>
  );
}
