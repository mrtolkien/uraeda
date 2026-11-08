// Uraeda's own places that no extension owns, each named once, with its icon and path: Home, Sessions
// (R6), New, and Settings. The navigation column, the phone's tabs, and the leader menu read them,
// beside the places the extensions register (`extensions/registry.ts`), the built-ins' first
// (`extensions/builtins/places.ts`), so a place is drawn the same everywhere (UI components).
import type { ComponentProps } from "react";
import type { Icon } from "@astryxdesign/core/Icon";

/** An icon's name, as Astryx's `Icon` takes it. */
type IconName = ComponentProps<typeof Icon>["icon"];

export type Destination = { icon: IconName; label: string; path: string };

export const DESTINATIONS = {
  home: { icon: "uraeda:home", label: "Home", path: "/" },
  new: { icon: "uraeda:plus", label: "New", path: "/new" },
  sessions: { icon: "uraeda:activity", label: "Sessions", path: "/sessions" },
  settings: { icon: "uraeda:settings", label: "Settings", path: "/settings" },
} as const satisfies Record<string, Destination>;
