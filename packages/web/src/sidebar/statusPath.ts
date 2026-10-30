// Where a card's status leads: apart from `cards.ts`, whose pure rules the unit tests run without a
// window, which `sessions.ts` needs.
import { waiting } from "../labels.ts";
import { sessionIdPath } from "../routeTable.ts";
import { sessionPath } from "../sessions.ts";
import { type Feature, needsYou, type Status } from "./cards.ts";

/**
 * Where a card's status leads: what the human must do while it needs them, the page asking it for a
 * gate or the feature's page for a problem; else the session its status follows, the one at work
 * on it or its latest.
 */
export function statusPath(feature: Feature, status: Status) {
  const { session } = feature.status;
  const followed = session === null ? sessionPath(feature.folder) : sessionIdPath(session);
  if (!needsYou(status)) {
    return followed;
  }
  if (feature.problems.length > 0) {
    return `/f/${feature.folder}`;
  }
  return feature.step.waitsOn === "human" ? waiting(feature).href : followed;
}
