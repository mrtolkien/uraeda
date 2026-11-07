// The theme picker, `Space u t` (US2): the key picker in page mode over every theme, dark ones
// first, the two in use marked. The page is the preview: the theme under the cursor draws the app,
// its mode included, until the picker closes. Enter keeps it as its mode's theme, switching the mode
// to it when the page showed the other; Escape, Back, or a tap outside put back the theme in use,
// for every close but Enter's goes through `onClose` (review focus 5). The preview names a theme by
// its id, so a file changed meanwhile redraws in its new colours (review focus 6).
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { useEffect, useState } from "react";
import type { Theme } from "uraeda-binding";
import { DEFAULTS, usePicks, useThemeList, useThemePreview } from "../theme.tsx";
import { KeyPicker } from "./KeyPicker.tsx";
import type { PickerItem } from "./pickerSources.ts";

/** A theme's mode, as the picks name them. */
const modeOf = (theme: Theme) => (theme.mode === "light" ? "light" : "dark");

/** The id a mode draws: its pick when the lists hold it, else its default. */
function inUse(themes: ReadonlyArray<Theme>, mode: "dark" | "light", picked: string) {
  return themes.some((theme) => theme.mode === mode && theme.id === picked)
    ? picked
    : DEFAULTS[mode];
}

/** The picker of the themes while `isOpen`; `onClose` when it closes, with a pick or without. */
export function ThemePicker({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const themes = useThemeList();
  const [picks, pick] = usePicks();
  const preview = useThemePreview();
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [cursor, setCursor] = useState<string>();
  // The mode the page shows without a preview, and its theme: the one Escape puts back.
  const shown = picks.mode === "system" ? (systemDark ? "dark" : "light") : picks.mode;
  const used = {
    dark: inUse(themes, "dark", picks.dark),
    light: inUse(themes, "light", picks.light),
  };
  const back = themes.find((theme) => theme.id === used[shown]);
  const kept = themes.find((theme) => theme.id === cursor) ?? back;
  // A picker gone with its preview still on, as the app signs out, leaves the page as picked.
  useEffect(() => () => preview(undefined), [preview]);
  const items: ReadonlyArray<PickerItem> = themes.map((theme) => ({
    aside: [theme.mode, used[modeOf(theme)] === theme.id && "in use", !theme.isShipped && "yours"]
      .filter(Boolean)
      .join(" · "),
    icon: "uraeda:palette",
    id: theme.id,
    kind: "notes",
    path: "",
    preview: { kind: "text", lines: [] },
    title: theme.name,
  }));
  const close = () => {
    preview(undefined);
    setCursor(undefined);
    onClose();
  };
  return (
    <KeyPicker
      inPage={{
        footer: `Enter keeps ${kept?.name ?? "it"} · Esc puts ${back?.name ?? "yours"} back`,
        onCursor: (item) => {
          setCursor(item?.id);
          preview(item?.id);
        },
        start: used[shown],
      }}
      isOpen={isOpen}
      items={items}
      label="Find a theme"
      onClose={close}
      onPick={(item) => {
        const theme = themes.find((one) => one.id === item.id);
        if (theme) {
          const mode = modeOf(theme);
          pick({ [mode]: theme.id, ...(mode === shown ? {} : { mode }) });
        }
        close();
      }}
      placeholder="Find a theme…"
      title="Theme"
    />
  );
}
