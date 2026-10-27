// The leader's tree: what `Space` and `g` lead to, declared where the shell mounts it. Each entry
// runs what a button or a page already runs: the places navigate (`destinations.ts`), New opens
// the page or the form of its button, Find opens the key picker over a kind, Continue opens what
// needs the human, `r` the repository menu, and `u t` cycles the theme. The entries of the UI group
// that fold the navigation and the right column are declared by those columns (`u [`, `u ]`), as
// a key belongs to the owner of its action.
import { openRepositoryMenu, RepositoryMenuHost } from "../RepositoryMenu.tsx";
import { navigateHere, useRepository } from "../routes.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { type Scheme, useScheme } from "../theme.tsx";
import { useContinue } from "./Continue.tsx";
import { useKeyPicker } from "./KeyPicker.tsx";
import { findBindings, goNewBinding, newBindings, placeBindings } from "./leaderTree.ts";
import { useKeys } from "./registry.tsx";
import { edge } from "./scroll.ts";
import type { Binding } from "./store.ts";

/** The theme after each: Mocha, then Latte, then the system's, then Mocha again. */
const NEXT: Record<Scheme, Scheme> = { latte: "system", mocha: "latte", system: "mocha" };

/** Declares the tree, and draws what it opens: Continue's picker and the repository menu. */
export function LeaderKeys() {
  const current = useRepository();
  const openForm = useOpenAddForm();
  const picker = useKeyPicker();
  const [scheme, setScheme] = useScheme();
  const { binding: continuing, picker: continuePicker } = useContinue();
  const bindings: Array<Binding> = [
    ...placeBindings("space", navigateHere),
    ...placeBindings("g", navigateHere),
    goNewBinding(navigateHere),
    ...findBindings(picker.open),
    ...newBindings(navigateHere, openForm),
    continuing,
    {
      // The leader's one hint, "space menu": it shows while the sequences do, and goes with them
      // when the single-key switch is off.
      hint: "space",
      hintLabel: "menu",
      hintPress: "space",
      icon: "uraeda:layers",
      keys: "space r",
      label: "Switch repository…",
      run: openRepositoryMenu,
    },
    {
      icon: "uraeda:palette",
      keys: "space u t",
      label: "Theme",
      run: () => setScheme(NEXT[scheme]),
    },
    {
      icon: "arrowUp",
      keys: "g g",
      label: "Top of the page",
      run: (event) => edge(event, "top"),
    },
  ];
  useKeys(bindings, "shell");
  return (
    <>
      <RepositoryMenuHost current={current} />
      {continuePicker}
    </>
  );
}
