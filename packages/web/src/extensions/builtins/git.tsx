// Git, a built-in extension: its place, among the column's actions with what waits on it, a tab on
// the phone's bar, and its keys, `Space g`, and `g G`, as `g g` is the top of a list. Its
// components stay where they are (R3): this registers them.
import { GitPage } from "../../pages.ts";
import { GitColumnAction } from "../../shell/ColumnPanes.tsx";
import { GitTab } from "../../shell/Tabs.tsx";
import { builtIn } from "./order.ts";
import { BUILT_IN_PLACES } from "./places.ts";

const { icon, label, path } = BUILT_IN_PLACES.git;

builtIn("git").place({
  action: GitColumnAction,
  column: "actions",
  component: GitPage,
  goKey: "G",
  icon,
  id: "git",
  key: "g",
  path,
  phoneTab: "bar",
  tab: GitTab,
  title: label,
});
