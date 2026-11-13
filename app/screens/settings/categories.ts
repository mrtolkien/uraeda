// The settings' categories, in the order the index lists them, each with the words of its
// settings: their name and their help, which the rows show and the search reads. The order puts
// what is changed most first: the look, then the keys and the runs, then what is set once.
import type { IconName } from "../../ui/controls";
import { FONT_ROLES } from "../../ui/tokens";

export type CategoryId =
  | "appearance"
  | "fonts"
  | "keyboard"
  | "runs"
  | "extensions"
  | "sign-in"
  | "server";

/**
 * A setting's words: its name, the line that says what it does, the keys that do it too, hinted
 * off the phone alone, and its other names.
 */
export type Words = { label: string; help: string; keys?: string; terms?: ReadonlyArray<string> };

export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** What it holds, one line, in the index. */
  about: string;
  settings: ReadonlyArray<Words>;
};

const THEMES = ["colour scheme", "color scheme", "theme", "dark", "light"];

export const CATEGORIES: ReadonlyArray<Category> = [
  {
    about: "The mode, the theme of each, and the desktop's notifications, kept on this device.",
    icon: "palette",
    id: "appearance",
    label: "Appearance",
    settings: [
      {
        help: "System follows this device's appearance: the light theme by day, the dark one by night.",
        keys: "Space u m cycles the three.",
        label: "Mode",
        terms: THEMES,
      },
      {
        help: "The theme of dark mode.",
        keys: "Space u t tries every theme from the keys.",
        label: "Dark theme",
        terms: THEMES,
      },
      { help: "The theme of light mode.", label: "Light theme", terms: THEMES },
      {
        help: "One TOML file per theme in the themes folder, beside config.toml: a file saved there shows in its mode's list at once.",
        label: "Your themes",
        terms: ["colour", "color", "custom", "file"],
      },
      {
        help: "While the app is in the background, its window or its browser tab, the desktop or the browser tells you when questions, a review, a pull request, or a blocked agent wait; a click opens it. In the app, a toast tells you either way.",
        label: "Notifications",
        terms: ["notify", "alert", "needs you", "desktop", "browser"],
      },
    ],
  },
  {
    about: "The font of each part of the app, kept on this device.",
    icon: "text-cursor-input",
    id: "fonts",
    label: "Fonts",
    settings: FONT_ROLES.map(({ help, label }) => ({ help, label, terms: ["font", "typeface"] })),
  },
  {
    about: "Single-key shortcuts, Vim in the text fields, and every key.",
    icon: "keyboard",
    id: "keyboard",
    label: "Keyboard",
    settings: [
      {
        help: "The leader key, the g sequences, and the letter keys of every page. Off, they all stop, and only the arrow keys, Enter, Escape, Tab, and Ctrl+K, which opens the leader's menu, still work.",
        label: "Single-key shortcuts",
        terms: ["leader", "space"],
      },
      {
        help: "Vim's keys in every text field, with the mode in the status line. Escape in normal mode leaves the field.",
        label: "Vim mode",
        terms: ["vi", "modal", "editor"],
      },
      {
        help: "Run in order when Vim starts, one per line, like imap jj <Esc>. Ctrl+Enter saves them.",
        label: "Vim commands",
        terms: ["vi", "map", "vimrc"],
      },
      {
        help: "Every key of the page in view, by what it does. ? opens it anywhere.",
        label: "Key map",
        terms: ["shortcuts", "keys", "help"],
      },
    ],
  },
  {
    about: "The default agent, how each step runs, and what continues by itself.",
    icon: "workflow",
    id: "runs",
    label: "Runs",
    settings: [
      {
        help: "The agent a new session runs on when nothing picks one, which every picker starts on. Unset, the first agent on runs; so does a repository where it is off.",
        label: "Default agent",
        terms: ["runtime", "Claude Code", "Codex", "model"],
      },
      {
        help: "Each step's agent, model, and effort, where a clean session starts, the build's implementers, and the reviewers. A feature starts from these, and can change its own.",
        label: "How each step runs",
        terms: ["run map", "reviewers", "implementers", "models", "effort"],
      },
      {
        help: "A run the server stopped while it worked continues by itself when the server starts again, if it stopped less than 6 hours before.",
        label: "Continue after a restart",
      },
      {
        help: "A run stopped by Claude Code's session limit continues a minute after the limit resets. Weekly limits still stop it.",
        label: "Continue after a usage limit",
      },
      {
        help: "How many times in a row Uraeda continues a run without a commit or a message from you, from 1 to 10. Past it, the run asks for you.",
        label: "Automatic continues in a row",
      },
      {
        help: "When the default branch gains code, decisions, or records, each pull request ready for your review is rebased on it by its agent, checked, and pushed again. A conflict that needs you stops it, with a comment.",
        label: "Catch up open pull requests",
      },
      {
        help: "Your jobs start by themselves at their times. Off, none starts until it is on again, and Run now still works.",
        label: "Run scheduled jobs",
        terms: ["jobs", "schedule", "cron"],
      },
    ],
  },
  {
    about: "The built-in agents and yours: where each is on, their settings, their problems.",
    icon: "plug",
    id: "extensions",
    label: "Extensions",
    // Its rows are the extensions the server lists: the search reads them from the record.
    settings: [],
  },
  {
    about: "The devices paired with this server, how to pair another, and a browser's key.",
    icon: "key-round",
    id: "sign-in",
    label: "Sign-in",
    settings: [
      {
        help: "Each signs in with a token of its own. Revoking one locks it out at once.",
        label: "Paired devices",
        terms: ["phone", "laptop", "revoke", "rename", "sign out"],
      },
      {
        help: "A device pairs once, with a one-time code that ura pair prints on the server's machine.",
        label: "Pair another device",
        terms: ["phone", "QR", "code"],
      },
      {
        help: "A browser signs in with the access key, which ura key shows once on the server's machine.",
        label: "Sign a browser in",
        terms: ["browser", "access key", "password"],
      },
      {
        help: "Where this app reaches Uraeda. A phone or a tablet names its server, and can name another.",
        label: "This app's server",
        terms: ["address", "connect", "disconnect", "switch", "remote"],
      },
    ],
  },
  {
    about: "The host names, the port, and the browser at start.",
    icon: "server",
    id: "server",
    label: "Server",
    settings: [
      {
        help: "Names the server accepts besides 127.0.0.1 and localhost, like the machine's name on your tailnet. A change applies to the next request.",
        label: "Allowed host names",
        terms: ["tailscale", "hostname", "address"],
      },
      { help: "The port on 127.0.0.1. A change applies at the next start.", label: "Port" },
      {
        help: "When the server starts, it opens Uraeda in your browser. A change applies at the next start.",
        label: "Open a browser at start",
      },
    ],
  },
];

/** The category of an id, `undefined` for one no category has. */
export const categoryOf = (id: string | undefined) => CATEGORIES.find((one) => one.id === id);

/** A category's setting by its name: the words its row shows. */
export function wordsOf(category: CategoryId, label: string): Words {
  const found = categoryOf(category)?.settings.find((one) => one.label === label);
  if (found === undefined) throw new Error(`No setting “${label}” in ${category}`);
  return found;
}

/** A setting the search found, and its category. */
export type Found = { category: Category; words: Words };

/**
 * The settings whose name, help, or other names hold `text`, in any case: those whose name holds
 * it first, then their other names, then their help, each in the categories' order; `extra` are
 * the extensions' words, which the record gives.
 */
export function search(text: string, extra: ReadonlyArray<Words>): ReadonlyArray<Found> {
  const needle = text.trim().toLowerCase();
  if (needle === "") return [];
  const has = (one: string) => one.toLowerCase().includes(needle);
  /** How far from its name a setting holds the text: 0 its name, 1 another, 2 its help. */
  const rank = ({ words }: Found) => (has(words.label) ? 0 : (words.terms ?? []).some(has) ? 1 : 2);
  const holds = (words: Words) => [words.label, words.help, ...(words.terms ?? [])].some(has);
  return holding(extra, holds, needle).toSorted((a, b) => rank(a) - rank(b));
}

/** What the search holds, in the categories' order, with a category found by its own name. */
function holding(extra: ReadonlyArray<Words>, holds: (words: Words) => boolean, needle: string) {
  return CATEGORIES.flatMap((category) => {
    const own = category.id === "extensions" ? extra : category.settings;
    const settings = own.filter(holds).map((words) => ({ category, words }));
    // A category found by its own name comes first, as a row of its own: "extensions" finds the
    // Extensions, which no setting's words held.
    const named = category.label.toLowerCase().includes(needle);
    const itself = { category, words: { help: category.about, label: category.label } };
    return named ? [itself].concat(settings) : settings;
  });
}
