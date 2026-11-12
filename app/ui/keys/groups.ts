// The leader menu's groups: what a prefix is called, and its icon, where the menu draws a group's
// entry. A feature whose sequence goes through a new group adds its line here: a sequence through
// a group this table does not name fails as it is declared, for the menu would draw nothing for it.

/**
 * A group's icon and label, and with `declared`, its entries in the order its keys are declared,
 * as its feature lists them by use, in place of the menu's order of their keys.
 */
export type Group = { declared?: boolean; icon: string; label: string };

/** The groups, by the keys that lead to them: "space n" is the keys Space then `n`. */
export const GROUPS: Readonly<Record<string, Group>> = {
  "space f": { icon: "search", label: "Find" },
  "space n": { icon: "plus", label: "New" },
  "space u": { icon: "palette", label: "UI" },
  "space u f": { icon: "palette", label: "Fonts" },
  // As the pane's menu lists them: the rare resets last, never third.
  "space w": { declared: true, icon: "layout-panel-left", label: "Panes" },
};
