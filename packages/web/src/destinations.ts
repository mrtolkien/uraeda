// The app's places, each named once, with its icon and path: the navigation column, the phone's
// tabs, and the leader menu all read them, so a place is drawn the same everywhere (UI coherence)
// and a new one is added here.
import type { ComponentProps } from "react";
import type { Icon } from "@astryxdesign/core/Icon";

/** An icon's name, as Astryx's `Icon` takes it. */
type IconName = ComponentProps<typeof Icon>["icon"];

export type Destination = { icon: IconName; label: string; path: string };

export const DESTINATIONS = {
  commit: { icon: "check", label: "Commit", path: "/commit" },
  decisions: { icon: "uraeda:decision-ruler", label: "Decisions", path: "/decisions" },
  home: { icon: "uraeda:home", label: "Home", path: "/" },
  inbox: { icon: "uraeda:inbox", label: "Inbox", path: "/inbox" },
  new: { icon: "uraeda:plus", label: "New", path: "/new" },
  priorities: { icon: "uraeda:list", label: "Priorities", path: "/priorities" },
  sessions: { icon: "uraeda:activity", label: "Sessions", path: "/sessions" },
  settings: { icon: "uraeda:settings", label: "Settings", path: "/settings" },
} as const satisfies Record<string, Destination>;
