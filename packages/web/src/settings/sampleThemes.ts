// Fixed themes for the stories of the Appearance section: the shipped lists as the spec names them,
// three theme files of the user's, Ember, Dusk under the contrast floor, and Broken, and the themes
// those files put in the lists. Their roles are empty: the rows show names, never colours.
import type { Theme, ThemeFile } from "uraeda-binding";
import type { AppearanceThemes } from "./AppearanceSettings.tsx";

/** A theme of the lists, by its name, its id the name in kebab case. */
function listed(name: string, mode: "dark" | "light", isShipped = true): Theme {
  const id = name
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replaceAll(" ", "-");
  return { id, isShipped, mode, name, palette: {}, roles: {}, sources: {} };
}

const DARK = [
  "Catppuccin Mocha",
  "Catppuccin Frappé",
  "Catppuccin Macchiato",
  "Dracula",
  "GitHub Dark",
  "GitHub Dark Dimmed",
  "GitHub Dark High Contrast",
  "Gruvbox Dark",
  "Kanagawa Dragon",
  "Kanagawa Wave",
  "Nord",
  "One Dark",
  "Rosé Pine",
  "Rosé Pine Moon",
  "Solarized Dark",
  "Tokyo Night",
  "Tokyo Night Moon",
  "Tokyo Night Storm",
];

const LIGHT = [
  "Catppuccin Latte",
  "Alucard",
  "GitHub Light",
  "GitHub Light High Contrast",
  "Gruvbox Light",
  "Kanagawa Lotus",
  "One Light",
  "Rosé Pine Dawn",
  "Solarized Light",
  "Tokyo Night Light",
];

/** The user's theme files: Ember, Dusk with two colours under the floor, and Broken. */
export const SAMPLE_FILES: ReadonlyArray<ThemeFile> = [
  {
    extends: "catppuccin-mocha",
    file: "broken.toml",
    id: "broken",
    isListed: true,
    mode: "dark",
    name: "Broken",
    problems: [
      {
        isWarning: false,
        line: 9,
        message: 'Line 9: needs-you names "embr", which is not in the palette.',
      },
    ],
  },
  {
    extends: "catppuccin-latte",
    file: "dusk.toml",
    id: "dusk",
    isListed: true,
    mode: "light",
    name: "Dusk",
    problems: [
      { isWarning: true, message: "ink-faint is 3.1:1 on page, under 4.5." },
      { isWarning: true, message: "rule is 2.4:1 on page, under 3." },
    ],
  },
  {
    extends: "catppuccin-mocha",
    file: "ember.toml",
    id: "ember",
    isListed: true,
    mode: "dark",
    name: "Ember",
    problems: [],
  },
];

/** The lists and the files, with the user's themes or without. */
export function sampleThemes(withFiles: boolean): AppearanceThemes {
  const yours = withFiles ? [listed("Broken", "dark", false), listed("Ember", "dark", false)] : [];
  return {
    files: withFiles ? SAMPLE_FILES : [],
    folder: "~/.config/uraeda/themes/",
    themes: [
      ...DARK.map((name) => listed(name, "dark")),
      ...yours,
      ...LIGHT.map((name) => listed(name, "light")),
      ...(withFiles ? [listed("Dusk", "light", false)] : []),
    ],
  };
}
