// The settings page's sections, in the order the form shows them, each with its settings: their
// icon, name, and line of help, the Extensions section's read from the server; and the search that
// filters the form's rows.
import type { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps } from "react";
import { ROLES } from "../theme/fonts.ts";

export type CategoryId =
  | "server"
  | "appearance"
  | "fonts"
  | "keyboard"
  | "sign-in"
  | "runs"
  | "extensions";

/** An icon's name, as Astryx's `Icon` takes it. */
export type IconName = ComponentProps<typeof Icon>["icon"];

/** A setting the section shows today: its icon, its name, and the line of help under it. */
export type Setting = {
  help: string;
  icon: IconName;
  label: string;
  /** Words besides its name and help that find it: its other names. */
  terms?: ReadonlyArray<string>;
};

export type Category = {
  icon: IconName;
  id: CategoryId;
  label: string;
  /** The settings the section shows today, in its order. */
  settings: ReadonlyArray<Setting>;
};

export const CATEGORIES: ReadonlyArray<Category> = [
  {
    icon: "uraeda:server",
    id: "server",
    label: "Server",
    settings: [
      {
        help: "Names the server accepts besides 127.0.0.1 and localhost, like the machine’s name on your tailnet. A change applies at once.",
        icon: "uraeda:globe",
        label: "Allowed host names",
      },
      {
        help: "The port on 127.0.0.1. A change applies at the next start.",
        icon: "uraeda:plug",
        label: "Port",
      },
      {
        help: "When the server starts, it opens Uraeda in your browser. A change applies at the next start.",
        icon: "externalLink",
        label: "Open a browser at start",
      },
    ],
  },
  {
    icon: "uraeda:palette",
    id: "appearance",
    label: "Appearance",
    settings: [
      {
        help: "System follows this device: the light theme by day, the dark theme by night. Kept on this browser only: each device picks its own.",
        icon: "uraeda:palette",
        label: "Mode",
        terms: ["colour scheme", "color scheme", "theme"],
      },
      {
        help: "The theme of dark mode. Space u t previews each theme as you move through the list.",
        icon: "uraeda:palette",
        label: "Dark theme",
        terms: ["colour scheme", "color scheme", "Catppuccin Mocha"],
      },
      {
        help: "The theme of light mode.",
        icon: "uraeda:palette",
        label: "Light theme",
        terms: ["colour scheme", "color scheme", "Catppuccin Latte"],
      },
      {
        // The settings page names the folder as the server gives it, in place of its description.
        help: "One TOML file per theme in the themes folder, beside config.toml. A file saved there shows in its mode's list at once. Copy a shipped theme from the documentation to start.",
        icon: "uraeda:palette",
        label: "Your themes",
        terms: ["colour", "color", "custom"],
      },
    ],
  },
  {
    icon: "uraeda:palette",
    id: "fonts",
    label: "Fonts",
    // One row for each part of the UI with a font of its own, kept on this browser only.
    settings: ROLES.map(({ help, label }) => ({
      help,
      icon: "uraeda:palette" as const,
      label,
      terms: ["font", "typeface"],
    })),
  },
  {
    icon: "uraeda:keyboard",
    id: "keyboard",
    label: "Keyboard",
    settings: [
      {
        help: "The leader key, g sequences, and the letter keys of every page. Arrow keys, Enter, Escape, and Ctrl or Cmd+K keep working when this is off. A change applies at once.",
        icon: "uraeda:keyboard",
        label: "Single-key shortcuts",
      },
      {
        help: "Vim's keys in every text field, with the mode in the status line. Escape in normal mode leaves the field; Shift+Escape leaves from any mode. Off on touch screens. A change applies at once.",
        icon: "uraeda:terminal",
        label: "Vim mode",
        terms: ["vi", "modal", "editor"],
      },
      {
        help: "Run in order when Vim starts, one per line, like imap jj <Esc>.",
        icon: "uraeda:terminal",
        label: "Vim commands",
        terms: ["vi", "map", "vimrc"],
      },
    ],
  },
  {
    icon: "uraeda:key-round",
    id: "sign-in",
    label: "Sign-in",
    settings: [
      {
        help: "This browser will need the access key again.",
        icon: "uraeda:log-out",
        label: "Sign out",
      },
      {
        help: "Every browser signed in to Uraeda, this one included, will need the access key again.",
        icon: "uraeda:log-out",
        label: "Sign out everywhere",
      },
    ],
  },
  {
    icon: "uraeda:workflow",
    id: "runs",
    label: "Runs",
    settings: [
      {
        help: "When a spec is approved, the plan and the build start in a new agent session instead of continuing the one that wrote the spec. Each approval can change it for its run. A change applies at once.",
        icon: "uraeda:terminal",
        label: "Build in a fresh session",
      },
      {
        help: "A run the server stopped while it worked continues by itself when the server starts again, if it stopped less than 6 hours before.",
        icon: "uraeda:workflow",
        label: "Continue after a restart",
      },
      {
        help: "A run stopped by Claude Code's session limit continues by itself when the limit resets. Weekly limits still stop the run.",
        icon: "uraeda:workflow",
        label: "Continue after a usage limit",
      },
      {
        help: "A run that ends before the next human gate is asked once to continue to it.",
        icon: "uraeda:workflow",
        label: "Continue before a human gate",
      },
      {
        help: "How many times in a row Uraeda continues a run without a commit or a message from you. Past it, the run asks for you.",
        icon: "uraeda:history",
        label: "Automatic continues in a row",
      },
    ],
  },
  {
    icon: "uraeda:plug",
    id: "extensions",
    label: "Extensions",
    // Its rows are the extensions the server lists, one each (`extensionsCategory`).
    settings: [],
  },
];

/** The category a path names, or undefined for an unknown one. */
export function categoryOf(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Whether a setting of `category` holds `text` in what the search reads. */
function holds(category: Category, setting: Setting, needle: string): boolean {
  const words = [setting.label, setting.help, ...(setting.terms ?? [])];
  return [category.label, ...words].some((word) => word.toLowerCase().includes(needle));
}

/**
 * Whether the search's `text`, trimmed and in any case, shows a setting of `category`: its name,
 * its help, one of its terms, or its section's name holds it. An empty text shows every setting.
 */
export function settingShown(category: Category, setting: Setting, text: string): boolean {
  const needle = text.trim().toLowerCase();
  return needle === "" || holds(category, setting, needle);
}

/** The setting of `category` named `label`, which the section's code draws. */
export function settingOf(category: Category, label: string): Setting {
  const found = category.settings.find((setting) => setting.label === label);
  if (!found) {
    throw new Error(`No setting ${label} in ${category.label}.`);
  }
  return found;
}

/** The labels of the settings of `category` that the search's `text` shows. */
export function shownLabels(category: Category, text: string): Set<string> {
  return new Set(
    category.settings
      .filter((setting) => settingShown(category, setting, text))
      .map(({ label }) => label),
  );
}

/** The id of a section in the page, which `/settings/<category>` scrolls to. */
export const sectionId = (id: CategoryId) => `settings-${id}`;
