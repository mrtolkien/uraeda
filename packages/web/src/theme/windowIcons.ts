// Lucide's glyphs of a live window: its width's device, and full screen. Written without JSX, which
// the theme's build does not compile; registered with Astryx by `icons.ts`.
import { createElement as h } from "react";
import { outline } from "./lucide.ts";

/** A monitor, for a live window at a desktop's width: Lucide's `monitor`. */
export const monitor = outline(
  h("rect", { height: 14, rx: 2, width: 20, x: 2, y: 3 }),
  h("line", { x1: 8, x2: 16, y1: 21, y2: 21 }),
  h("line", { x1: 12, x2: 12, y1: 17, y2: 21 }),
);

/** A phone, for a live window at a phone's width: Lucide's `smartphone`. */
export const smartphone = outline(
  h("rect", { height: 20, rx: 2, ry: 2, width: 14, x: 5, y: 2 }),
  h("path", { d: "M12 18h.01" }),
);

/** Two arrows apart, for full screen: Lucide's `maximize-2`. */
export const maximize = outline(
  h("polyline", { points: "15 3 21 3 21 9" }),
  h("polyline", { points: "9 21 3 21 3 15" }),
  h("line", { x1: 21, x2: 14, y1: 3, y2: 10 }),
  h("line", { x1: 3, x2: 10, y1: 21, y2: 14 }),
);

/** Two arrows together, for leaving full screen: Lucide's `minimize-2`. */
export const minimize = outline(
  h("polyline", { points: "4 14 10 14 10 20" }),
  h("polyline", { points: "20 10 14 10 14 4" }),
  h("line", { x1: 14, x2: 21, y1: 10, y2: 3 }),
  h("line", { x1: 3, x2: 10, y1: 21, y2: 14 }),
);
