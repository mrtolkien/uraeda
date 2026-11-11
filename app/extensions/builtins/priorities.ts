// The priorities and proposals, a built-in extension: its place (`g p`, `Space p`, `/priorities`)
// and its pane of Home, Priorities now. Its screens are `app/screens/priorities/` and `proposal/`:
// this declares them.
import { builtIn } from "./declare";

export const priorities = builtIn({
  homePanes: [{ column: 1, icon: "list", id: "now", kind: "home-now", title: "Priorities now" }],
  name: "priorities",
  places: [
    {
      icon: "list",
      id: "priorities",
      key: "p",
      pages: ["priorities", "proposal"],
      title: "Priorities",
      to: { page: "priorities" },
    },
  ],
  title: "Priorities and proposals",
});
