// The settings page's sections, in the order the form shows them, each with its settings: their
// icon, name, and line of help, then the settings later features bring, each named with the
// feature that brings it; and the search that filters the form's rows, the settings to come too.
import type { Icon } from "@astryxdesign/core/Icon";
import type { ComponentProps } from "react";

export type CategoryId =
  | "server"
  | "appearance"
  | "keyboard"
  | "sign-in"
  | "agents"
  | "runs"
  | "reviews";

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

/** A setting a later feature brings: what it sets, and that feature. */
export type PlannedSetting = { feature: string; label: string };

export type Category = {
  icon: IconName;
  id: CategoryId;
  label: string;
  /** The settings to come, which later features bring. */
  planned?: ReadonlyArray<PlannedSetting>;
  /** The settings the section shows today, in its order. */
  settings: ReadonlyArray<Setting>;
};

/** The icon of a setting to come: it waits for its feature. */
export const PLANNED_ICON: IconName = "clock";

/** The help line of a setting to come. */
export const plannedHelp = (setting: PlannedSetting) => `Comes with ${setting.feature}.`;

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
        help: "Catppuccin Mocha is dark, Latte is light, and System follows this device. Kept on this browser only: each device picks its own.",
        icon: "uraeda:palette",
        label: "Colour scheme",
        terms: ["theme"],
      },
      {
        // TEMPORARY: the Monaspace experiment (`theme/fonts.ts`).
        help: "Current is Inter for prose and JetBrains Mono for the rest. Monaspace gives each part its own face: Neon for the UI, Argon for prose, Xenon for headings, Radon for your messages in a session, and Krypton for code. Kept on this browser only.",
        icon: "uraeda:palette",
        label: "Fonts",
        terms: ["font", "monaspace", "typeface"],
      },
    ],
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
    icon: "uraeda:harness-agent",
    id: "agents",
    label: "Agents",
    planned: [
      { feature: "the Codex runtime", label: "The agent that runs each step" },
      { feature: "the Codex runtime", label: "The model and effort of each step" },
    ],
    settings: [],
  },
  {
    icon: "uraeda:workflow",
    id: "runs",
    label: "Runs",
    planned: [
      {
        feature: "run options",
        label: "One session for the whole feature, or a new session at each step",
      },
      { feature: "run options", label: "Sub-agents during the implementation" },
      { feature: "run options", label: "A different choice for one feature" },
    ],
    settings: [
      {
        help: "When a spec is approved, the plan and the build start in a new agent session instead of continuing the one that wrote the spec. Each approval can change it for its run. A change applies at once.",
        icon: "uraeda:terminal",
        label: "Build in a fresh session",
      },
    ],
  },
  {
    icon: "uraeda:step-review",
    id: "reviews",
    label: "Reviews",
    planned: [
      { feature: "review settings", label: "The review's command, model, and number of reviewers" },
      { feature: "the adversarial review", label: "A second review by another model" },
    ],
    settings: [],
  },
];

/** The category a path names, or undefined for an unknown one. */
export function categoryOf(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** Whether a setting of `category`, today's or to come, holds `text` in what the search reads. */
function holds(category: Category, setting: Setting | PlannedSetting, needle: string): boolean {
  const words =
    "help" in setting
      ? [setting.label, setting.help, ...(setting.terms ?? [])]
      : [setting.label, plannedHelp(setting)];
  return [category.label, ...words].some((word) => word.toLowerCase().includes(needle));
}

/**
 * Whether the search's `text`, trimmed and in any case, shows a setting of `category`: its name,
 * its help, one of its terms, or its section's name holds it. An empty text shows every setting.
 */
export function settingShown(
  category: Category,
  setting: Setting | PlannedSetting,
  text: string,
): boolean {
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

/** The labels of the settings of `category`, today's and to come, that the search's `text` shows. */
export function shownLabels(category: Category, text: string): Set<string> {
  return new Set(
    [...category.settings, ...(category.planned ?? [])]
      .filter((setting) => settingShown(category, setting, text))
      .map(({ label }) => label),
  );
}

/** The id of a section in the page, which `/settings/<category>` scrolls to. */
export const sectionId = (id: CategoryId) => `settings-${id}`;
