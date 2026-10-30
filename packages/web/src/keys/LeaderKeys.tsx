// The leader's tree: what `Space` and `g` lead to, declared where the shell mounts it. Each entry
// runs what a button or a page already runs: the places navigate (`destinations.ts`), New opens
// the page or the form of its button, Find opens the key picker over a kind, Continue opens what
// needs the human, `r` the repository menu, `u t` cycles the theme, and `u f` then a part's key
// opens the picker of that part's font (`FontPicker`), or `d` restores the default fonts, once
// confirmed. `?` and `Space ?` open the key map (`KeyMap`), of the keys that work where the focus was.
// The entries of the UI group
// that fold the navigation and the right column are declared by those columns (`u [`, `u ]`), as
// a key belongs to the owner of its action.
import { useState } from "react";
import { openRepositoryMenu, RepositoryMenuHost } from "../RepositoryMenu.tsx";
import { navigateHere, useRepository } from "../routes.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { type Scheme, useScheme } from "../theme.tsx";
import { useConfirm } from "../fields/Confirm.tsx";
import { type FontRole, restoreDefaultFonts, ROLES } from "../theme/fonts.ts";
import { FontPicker } from "./FontPicker.tsx";
import { useContinue } from "./Continue.tsx";
import { useKeyPicker } from "./KeyPicker.tsx";
import { useKeyMap } from "./KeyMap.tsx";
import {
  findBindings,
  goCommitBinding,
  goNewBinding,
  newBindings,
  placeBindings,
} from "./leaderTree.ts";
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
  const [fontRole, setFontRole] = useState<FontRole>();
  const confirm = useConfirm();
  const { binding: continuing, picker: continuePicker } = useContinue();
  const { bindings: keyMapping, keyMap } = useKeyMap();
  const bindings: Array<Binding> = [
    ...placeBindings("space", navigateHere),
    ...placeBindings("g", navigateHere),
    goNewBinding(navigateHere),
    goCommitBinding(navigateHere),
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
    ...keyMapping,
    // The same from the go keys, as `g h` goes home.
    {
      icon: "uraeda:layers",
      keys: "g r",
      label: "Switch repository…",
      run: openRepositoryMenu,
    },
    {
      icon: "uraeda:palette",
      keys: "space u t",
      label: "Theme",
      run: () => setScheme(NEXT[scheme]),
    },
    ...ROLES.map(({ key, label, role }) => ({
      icon: "uraeda:palette" as const,
      keys: `space u f ${key}`,
      label: `${label}…`,
      run: () => setFontRole(role),
    })),
    {
      icon: "uraeda:palette",
      keys: "space u f d",
      label: "Default fonts…",
      run: async () => {
        const restores = await confirm({
          body: "Every part of the UI goes back to its default font: Atkinson Hyperlegible Next for prose, Monaspace for the rest.",
          cancel: "Keep mine",
          confirm: "Restore",
          title: "Restore the default fonts?",
        });
        if (restores) {
          restoreDefaultFonts();
        }
      },
    },
    {
      icon: "arrowUp",
      keys: "g g",
      label: "Top of the page",
      run: (event) => edge(event, "top"),
    },
    {
      // The browser's Back, as Alt+Left: on every page, with no hint in the status line.
      keys: "b",
      label: "Back",
      run: () => {
        // Nothing before this page: nothing to go back to.
        if (window.history.length <= 1) {
          return false;
        }
        window.history.back();
      },
    },
  ];
  useKeys(bindings, "shell");
  return (
    <>
      <RepositoryMenuHost current={current} />
      {continuePicker}
      <FontPicker onClose={() => setFontRole(undefined)} role={fontRole} />
      {keyMap}
    </>
  );
}
