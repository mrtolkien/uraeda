// The inbox, a built-in extension: its place (`Space i`, `/inbox`, with its notes' count, a tab on
// the phone's bar, and its ＋), its home pane, its New-page section, its Find key (`Space f n`), and
// its New key (`Space n n`). Its components stay where they are (R3): this registers them.
import { InboxNewSection } from "../../NewEntries.tsx";
import { InboxHomeSection } from "../../home/panes.tsx";
import { KIND_ICONS } from "../../keys/kinds.ts";
import { openPicker } from "../../keys/pickerState.ts";
import { InboxRoute } from "../../pages.ts";
import { InboxNavRow } from "../../shell/ColumnPanes.tsx";
import { InboxTab } from "../../shell/Tabs.tsx";
import { openAddForm } from "../../SidebarAdd.tsx";
import { builtIn } from "./order.ts";
import { BUILT_IN_PLACES } from "./places.ts";

const { icon, label, path } = BUILT_IN_PLACES.inbox;
const inbox = builtIn("inbox");

inbox.place({
  component: () => <InboxRoute />,
  goKey: "i",
  icon,
  id: "inbox",
  key: "i",
  navRow: InboxNavRow,
  path,
  phoneTab: "bar",
  tab: InboxTab,
  title: label,
});
inbox.homePane({
  column: 0,
  icon,
  id: "inbox",
  section: InboxHomeSection,
  title: "Inbox",
  tone: "neutral",
});
inbox.newSection({ id: "inbox", section: InboxNewSection, title: "Inbox", tone: "neutral" });
inbox.key({
  icon: KIND_ICONS.notes,
  keys: "space f n",
  label: "Notes",
  run: () => openPicker("notes"),
});
inbox.key({
  icon: KIND_ICONS.notes,
  keys: "space n n",
  label: "Note (inbox entry)",
  run: () => openAddForm("note"),
});
