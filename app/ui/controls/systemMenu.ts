// On a Mac a menu of actions and a select's list open as the system's own menu, as every Mac app's
// do: glass, under the trigger, with the system's keys (the arrows, a letter, Return, Escape) and
// its look. Each row becomes an item: its icon a template the menu tints, a tick on the value a
// select holds, a line above a menu's next group. Elsewhere the app draws its own list
// (`Options`), with the page's keys shown on its rows.
import type { ViewRef } from "nsh";
import { Menu as SystemMenu, type MenuItem } from "nsh/desktop";
import { svgOf } from "./Icon";
import type { Row } from "./Options";
import { mac } from "../native";

/** Whether menus and selects open as the system's own menu. */
export const systemMenus = mac;

/** The system's items of `rows`: picking one calls `onPick` with its place. */
export function itemsOf(rows: ReadonlyArray<Row>, onPick: (at: number) => void): MenuItem[] {
  // The menu shows icons on every row or on none: a lone icon would push its row's words aside.
  const icons = rows.every((row) => row.icon !== undefined);
  return rows.flatMap((row, at): MenuItem[] => {
    const item: MenuItem = {
      checked: row.picked,
      disabled: row.disabled,
      icon:
        icons && row.icon !== undefined
          ? `data:image/svg+xml;utf8,${encodeURIComponent(svgOf(row.icon, "#000", 16))}`
          : undefined,
      label: row.hint === undefined ? row.label : `${row.label} — ${row.hint}`,
      onSelect: () => onPick(at),
    };
    return row.ruled === true && at > 0 ? [{ type: "separator" }, item] : [item];
  });
}

/**
 * Opens the system's menu of `rows` under `anchor`, its left edge on the anchor's, or at the
 * pointer when the anchor is not drawn: it resolves once the menu closed, picked or dismissed.
 */
export async function popUnder(
  anchor: ViewRef | undefined,
  rows: ReadonlyArray<Row>,
  onPick: (at: number) => void,
): Promise<void> {
  const at = await anchor?.measure();
  const point =
    at == null
      ? undefined
      : { x: at.pagePosition.x, y: at.pagePosition.y + at.bounds.size.height + 4 };
  // Picked once the menu closed: what the pick opens is drawn over the page, not under the menu.
  let picked: number | undefined;
  await SystemMenu.popup(
    itemsOf(rows, (index) => {
      picked = index;
    }),
    point,
  );
  if (picked !== undefined) onPick(picked);
}
