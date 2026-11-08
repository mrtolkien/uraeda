// The Sessions place: no extension, always on (R6), registered as the built-ins' places are so that
// it keeps its place among them: `Space s`, `/sessions`, and a tab on the phone's bar with the
// running sessions' count. The column draws no row for it: its panes are the sessions.
import { DESTINATIONS } from "../../destinations.ts";
import { SessionsPage } from "../../pages.ts";
import { SessionsTab } from "../../shell/Tabs.tsx";
import { builtIn } from "./order.ts";

const { icon, label, path } = DESTINATIONS.sessions;

builtIn("sessions").place({
  column: "none",
  component: SessionsPage,
  goKey: "s",
  icon,
  id: "sessions",
  key: "s",
  path,
  phoneTab: "bar",
  tab: SessionsTab,
  title: label,
});
