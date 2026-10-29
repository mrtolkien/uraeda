// The leader menu's groups: what a prefix is called, and its icon, where the menu draws a group's
// entry. The group of a prefix not listed here has no entry until a feature names it.
import type { IconName } from "./store.ts";

export type Group = { icon: IconName; label: string };

/** The groups, by the keys that lead to them: "space n" is the keys Space then `n`. */
export const GROUPS: Readonly<Record<string, Group>> = {
  "space f": { icon: "search", label: "Find" },
  "space n": { icon: "uraeda:plus", label: "New" },
  "space u": { icon: "uraeda:palette", label: "UI" },
  "space u f": { icon: "uraeda:palette", label: "Fonts" },
};
