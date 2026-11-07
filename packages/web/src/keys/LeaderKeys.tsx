// The leader's tree: what `Space` and `g` lead to, declared where the shell mounts it. Each entry
// runs what a button or a page already runs: the places navigate (`destinations.ts`), New opens
// the page or the form of its button, Find opens the key picker over a kind, Continue opens what
// needs the human, `r` the repository menu, `u m` cycles the colour mode, `u t` opens the theme
// picker (`ThemePicker`), and `u f` then a part's
// key opens the picker of that part's font (`FontPicker`), or `d` restores the default fonts, once
// confirmed. `?` and `Space ?` open the key map (`KeyMap`), of the keys that work where the focus
// was. The entries of the UI group that fold the navigation and the right column are declared by
// those columns (`u [`, `u ]`), as a key belongs to the owner of its action.
import { useState } from "react";
import { openRepositoryMenu, RepositoryMenuHost } from "../RepositoryMenu.tsx";
import { navigateHere, useRepository } from "../routes.tsx";
import { useOpenAddForm } from "../SidebarAdd.tsx";
import { type Mode, usePicks } from "../theme.tsx";
import { useConfirm } from "../fields/Confirm.tsx";
import { type FontRole, restoreDefaultFonts, ROLES } from "../theme/fonts.ts";
import { FontPicker } from "./FontPicker.tsx";
import { useContinue } from "./Continue.tsx";
import { useKeyPicker } from "./KeyPicker.tsx";
import { useKeyMap } from "./KeyMap.tsx";
import { ThemePicker } from "./ThemePicker.tsx";
import {
  findBindings,
  goGitBindings,
  goNewBinding,
  newBindings,
  placeBindings,
} from "./leaderTree.ts";
import { useKeys } from "./registry.tsx";
import { edge } from "./scroll.ts";
import type { Binding } from "./store.ts";

/** The mode after each: the system's, then Light, then Dark, then the system's again. */
const NEXT: Record<Mode, Mode> = { dark: "system", light: "dark", system: "light" };

/** Restores the default fonts, once the human confirms it. */
async function confirmDefaultFonts(confirm: ReturnType<typeof useConfirm>) {
  const restores = await confirm({
    body: "Every part of the UI goes back to its default font: Atkinson Hyperlegible Next for prose, Monaspace for the rest.",
    cancel: "Keep mine",
    confirm: "Restore",
    title: "Restore the default fonts?",
  });
  if (restores) {
    restoreDefaultFonts();
  }
}

/** Declares the tree, and draws what it opens: Continue's picker and the repository menu. */
export function LeaderKeys() {
  const current = useRepository();
  const openForm = useOpenAddForm();
  const picker = useKeyPicker();
  const [picks, pick] = usePicks();
  const [fontRole, setFontRole] = useState<FontRole>();
  const [isPickingTheme, setPickingTheme] = useState(false);
  const confirm = useConfirm();
  const { binding: continuing, picker: continuePicker } = useContinue();
  const { bindings: keyMapping, keyMap } = useKeyMap();
  const bindings: Array<Binding> = [
    ...placeBindings("space", navigateHere),
    ...placeBindings("g", navigateHere),
    goNewBinding(navigateHere),
    ...goGitBindings(navigateHere),
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
      keys: "space u m",
      label: "Mode",
      run: () => pick({ mode: NEXT[picks.mode] }),
    },
    {
      icon: "uraeda:palette",
      keys: "space u t",
      label: "Theme…",
      run: () => setPickingTheme(true),
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
      run: () => confirmDefaultFonts(confirm),
    },
    {
      // A fallback, as `G` is: a list's `g g` goes to its first row instead.
      fallback: true,
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
      <ThemePicker isOpen={isPickingTheme} onClose={() => setPickingTheme(false)} />
      {keyMap}
    </>
  );
}
