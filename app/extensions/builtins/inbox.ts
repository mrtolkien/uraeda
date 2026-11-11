// The inbox, a built-in extension: its place (`g i`, `Space i`, `/inbox`, with its notes' count),
// its pane of Home, and its New key, `Space n i`. Its screens are `app/screens/inbox/` and
// `triage/`: this declares them.
import { builtIn } from "./declare";
import { navigate, record } from "../../store";

export const inbox = builtIn({
  homePanes: [{ column: 1, icon: "inbox", id: "inbox", kind: "home-inbox", title: "Inbox" }],
  keys: [
    {
      icon: "inbox",
      keys: "n i",
      label: "Note",
      run: () => navigate({ page: "inbox" }, { focus: "text" }),
    },
  ],
  name: "inbox",
  places: [
    {
      count: (repo) => record("Inbox", { repo })()?.count,
      icon: "inbox",
      id: "inbox",
      key: "i",
      pages: ["inbox", "note", "triage"],
      title: "Inbox",
      to: { page: "inbox" },
    },
  ],
  title: "Inbox",
});
