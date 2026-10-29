// The picker of a part's font, opened by `Space u f` then the part's key: the bundled fonts, the
// one in use marked. A pick sets it at once, as the settings' Fonts section does.
import { FONTS, type FontRole, pickFont, ROLES, useFonts } from "../theme/fonts.ts";
import { KeyPicker } from "./KeyPicker.tsx";
import type { PickerItem } from "./pickerSources.ts";

/** What each font's preview shows, written in it: a heading, prose, figures, and code. */
const SAMPLE = `Leader key/shortcut map

Outside text fields, Space opens a menu of what the next key does. Keys typed quickly run without showing it. A group key goes down a level, Backspace goes up, and Escape closes.

Every shortcut is declared in one registry, pages share a base keymap, and single-key shortcuts can be switched off and are never the only path.

The quick brown fox jumps over the lazy dog. THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG.
0123456789 — 1440 px · 64% · $12.50 · 3/4 · "quotes" and 'apostrophes'

Il1| O0o rn m cl d {[()]} <= >= != -> => ===
const answer = { letters: ["A", "B"], comment: "Il1|O0" };`;

/** The picker of `role`'s font while it is given; `onClose` when it closes. */
export function FontPicker({ onClose, role }: { onClose: () => void; role: FontRole | undefined }) {
  const fonts = useFonts();
  const part = ROLES.find((one) => one.role === role);
  const items: ReadonlyArray<PickerItem> = FONTS.map((font) => ({
    family: font.family,
    icon: "uraeda:palette",
    id: font.id,
    kind: "notes",
    path: "",
    preview: SAMPLE,
    title: role && fonts[role] === font.id ? `${font.label} · in use` : font.label,
  }));
  return (
    <KeyPicker
      isOpen={role !== undefined}
      items={items}
      label="Find a font"
      onClose={onClose}
      onPick={(item) => {
        if (role) {
          pickFont(role, item.id);
        }
        onClose();
      }}
      placeholder="Font…"
      title={`${part?.label ?? "The"} font`}
    />
  );
}
