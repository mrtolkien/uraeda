// The icon of each kind the key picker finds, written once: the picker's rows, Continue's rows, and
// the leader's Find entries draw a kind the same.
import { DESTINATIONS } from "../destinations.ts";
import { BUILT_IN_PLACES } from "../extensions/builtins/places.ts";
import type { PickerKind } from "./pickerSources.ts";
import type { IconName } from "./store.ts";

export const KIND_ICONS: Record<PickerKind, IconName> = {
  changes: "wrench",
  decisions: BUILT_IN_PLACES.decisions.icon,
  // The New page's card for a feature, and the leader's New group: a kind is drawn the same wherever
  // it is named, a note too, in the Note button's pencil's place (R135).
  features: "uraeda:file-text",
  notes: BUILT_IN_PLACES.inbox.icon,
  priorities: BUILT_IN_PLACES.priorities.icon,
  sessions: DESTINATIONS.sessions.icon,
};
