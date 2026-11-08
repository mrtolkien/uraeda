// The priorities and proposals, a built-in extension: its place (`Space p`, `/priorities`, with
// Now's count and its ＋, a tab on the phone's bar), its home pane, Priorities now, its New-page
// section, its Find key (`Space f p`), and its New key (`Space n p`), a new proposal's row at the
// top of Now. Its components stay where they are (R3): this registers them.
import { PrioritiesNewSection } from "../../NewEntries.tsx";
import { PrioritiesHomeSection } from "../../home/panes.tsx";
import { KIND_ICONS } from "../../keys/kinds.ts";
import { openPicker } from "../../keys/pickerState.ts";
import { NEW_PROPOSAL_HASH } from "../../lists/PrioritiesList.tsx";
import { PrioritiesRoute } from "../../pages.ts";
import { navigateHere } from "../../routes.tsx";
import { PrioritiesNavRow } from "../../shell/ColumnPanes.tsx";
import { builtIn } from "./order.ts";
import { BUILT_IN_PLACES } from "./places.ts";

const { icon, label, path } = BUILT_IN_PLACES.priorities;
const priorities = builtIn("priorities");

priorities.place({
  component: () => <PrioritiesRoute isHome={false} />,
  goKey: "p",
  icon,
  id: "priorities",
  key: "p",
  navRow: PrioritiesNavRow,
  path,
  phoneTab: "bar",
  title: label,
});
priorities.homePane({
  column: 1,
  icon,
  id: "now",
  section: PrioritiesHomeSection,
  title: "Priorities now",
  tone: "now",
});
priorities.newSection({
  id: "priorities",
  section: PrioritiesNewSection,
  title: "Priorities",
  tone: "now",
});
priorities.key({
  icon: KIND_ICONS.priorities,
  keys: "space f p",
  label: "Priorities",
  run: () => openPicker("priorities"),
});
priorities.key({
  icon: KIND_ICONS.priorities,
  keys: "space n p",
  label: "Proposal",
  run: () => navigateHere(`/priorities${NEW_PROPOSAL_HASH}`),
});
