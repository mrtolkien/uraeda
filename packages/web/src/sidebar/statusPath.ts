// Where a card's status leads: apart from `cards.ts`, whose pure rules the unit tests run without a
// window, which `sessions.ts` needs.
import { waiting } from "../labels.ts";
import { sessionPath } from "../sessions.ts";
import { type Feature, needsYou, type Status } from "./cards.ts";

/**
 * Where a card's status leads: what the human must do while it needs them, the page asking it for a
 * gate or the feature's page for a problem; its session otherwise.
 */
export function statusPath(feature: Feature, status: Status) {
  if (!needsYou(status)) {
    return sessionPath(feature.folder);
  }
  if (feature.problems.length > 0) {
    return `/f/${feature.folder}`;
  }
  return feature.step.waitsOn === "human" ? waiting(feature).href : sessionPath(feature.folder);
}
