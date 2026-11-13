// A layout in one line, for the tables of `layout.test.ts` and `moves.test.tsx`, and for the check
// pages, which print it: each stack's tabs, the shown one in brackets, the focused one starred.
import type { Layout } from "../layout";

/** A layout in one line: each stack's tabs, the shown one in brackets, the focused one starred. */
export function seen(layout: Layout): string {
  const stack = (name: "main" | "side") => {
    const { panes, shown, split: isSplit } = layout[name];
    const tabs = panes.map(({ key }) => {
      const mark = key === layout.focus ? "*" : "";
      return !isSplit && key === shown ? `[${key}${mark}]` : `${key}${mark}`;
    });
    const how = isSplit ? " split" : "";
    const folded = name === "side" && layout.folded ? " folded" : "";
    return `${name}${how}${folded}: ${tabs.join(" ") || "-"}`;
  };
  const tabs = layout.onTabs ? " | on tabs" : "";
  const zoomed = layout.zoomed === null ? "" : ` | zoomed ${layout.zoomed}`;
  return `${stack("main")} | ${stack("side")}${tabs}${zoomed}`;
}
