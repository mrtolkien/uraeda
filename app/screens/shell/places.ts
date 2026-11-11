// The app's places, each named once, with its icon, its key, and the pages that belong to it: the
// rail, the phone's bar, and the leader's tree read them, so a place is drawn and reached the same
// everywhere. `g <key>` goes to a place, and so does `Space <key>`, but for New, whose `Space n` is
// the New group of the leader's menu. On the phone's bar, the places visited most are one tap away,
// Decisions, Jobs, and Settings wait in its `…`, and New ends it.
import type { Route } from "../../store";
import type { IconName } from "../../ui/controls";

export type Place = {
  icon: IconName;
  /** The key after `g`, and after `Space` unless `goOnly`. */
  key: string;
  label: string;
  /** The pages it holds: the rail lights it while one of them shows. */
  pages: ReadonlyArray<Route["page"]>;
  /** Where a press goes: its first page, in the repository shown. */
  to: Route;
  /** Its key goes after `g` alone: `Space` and the key is a group of the menu. */
  goOnly?: boolean;
  /** Where the phone's bar puts it (`RailPlace`): the bar, the `…`'s menu, or after the `…`. */
  onPhone?: "more" | "end";
};

export const PLACES: ReadonlyArray<Place> = [
  { icon: "house", key: "h", label: "Home", pages: ["home"], to: { page: "home" } },
  {
    icon: "list",
    key: "p",
    label: "Priorities",
    pages: ["priorities", "proposal"],
    to: { page: "priorities" },
  },
  {
    icon: "inbox",
    key: "i",
    label: "Inbox",
    pages: ["inbox", "note", "triage"],
    to: { page: "inbox" },
  },
  {
    icon: "message-square",
    key: "s",
    label: "Sessions",
    pages: ["sessions", "session-id"],
    to: { page: "sessions" },
  },
  {
    icon: "scale",
    key: "d",
    label: "Decisions",
    onPhone: "more",
    pages: ["decisions", "decision", "decisions-check", "constitution"],
    to: { page: "decisions" },
  },
  // `g c`, as "commit" was before the Git page: `g g` is a list's first row (`specs/ui/keyboard.md`).
  { icon: "git-branch", key: "c", label: "Git", pages: ["git"], to: { page: "git" } },
  {
    icon: "clock",
    key: "j",
    label: "Jobs",
    onPhone: "more",
    pages: ["jobs", "job", "job-new"],
    to: { page: "jobs" },
  },
  {
    goOnly: true,
    icon: "plus",
    key: "n",
    label: "New",
    onPhone: "end",
    pages: ["new"],
    to: { page: "new" },
  },
  {
    icon: "settings",
    key: ",",
    label: "Settings",
    onPhone: "more",
    pages: ["settings"],
    to: { page: "settings" },
  },
];

/** The place a page belongs to, if any. */
export const placeOfPage = (page: Route["page"]): Place | undefined =>
  PLACES.find((place) => place.pages.includes(page));
