// The icon of each kind the key picker finds, written once: the picker's rows, Continue's rows, and
// the leader's Find entries draw a kind the same.
import { DESTINATIONS } from "../destinations.ts";
import type { PickerKind } from "./pickerSources.ts";
import type { IconName } from "./store.ts";

export const KIND_ICONS: Record<PickerKind, IconName> = {
  changes: "wrench",
  decisions: DESTINATIONS.decisions.icon,
  // The New page's card for a feature, and the leader's New group: a kind is drawn the same wherever
  // it is named, a note too, in the Note button's pencil's place (R135).
  features: "uraeda:file-text",
  notes: DESTINATIONS.inbox.icon,
  priorities: DESTINATIONS.priorities.icon,
  sessions: DESTINATIONS.sessions.icon,
};
