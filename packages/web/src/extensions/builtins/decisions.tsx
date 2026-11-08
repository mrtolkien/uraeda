// The decisions, a built-in extension: its place (`Space d`, `/decisions`, in the phone's `…`) and
// its Find key (`Space f d`). Its components stay where they are (R3): this registers them.
import { KIND_ICONS } from "../../keys/kinds.ts";
import { openPicker } from "../../keys/pickerState.ts";
import { DecisionsPage } from "../../pages.ts";
import { builtIn } from "./order.ts";
import { BUILT_IN_PLACES } from "./places.ts";

const { icon, label, path } = BUILT_IN_PLACES.decisions;
const decisions = builtIn("decisions");

decisions.place({
  component: DecisionsPage,
  goKey: "d",
  icon,
  id: "decisions",
  key: "d",
  path,
  phoneTab: "more",
  title: label,
});
decisions.key({
  icon: KIND_ICONS.decisions,
  keys: "space f d",
  label: "Decisions",
  run: () => openPicker("decisions"),
});
