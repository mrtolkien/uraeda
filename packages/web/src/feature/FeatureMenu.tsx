// The feature's "…" beside its title: Rename, which opens the shell card's settings, and Drop,
// behind its confirmation, as the session's "…" has it. A dropped item leaves its page for Home,
// where what stayed is said, once the priorities commit succeeded.
import { type SessionItem, UNCOMMITTED, useDropItem } from "../dropItem.ts";

import { addNote, HOME_NOTES } from "../offers.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { useOpenSettings } from "../sidebar/FeatureSettingsDialog.tsx";
import { ActionsMenu } from "../layout/ActionsMenu.tsx";

/**
 * "Feature actions", or "Change actions": "Rename" and "Drop the feature…" or "Drop the change…". A
 * drop the server refuses, or whose priorities commit failed, is told to `onRefused`, which shows it under the name; one the human
 * keeps changes nothing.
 */
export function FeatureMenu({
  feature,
  item,
  onRefused,
}: {
  feature: { folder: string; label: string | null; slug: string };
  item: SessionItem;
  onRefused: (message: string) => void;
}) {
  const here = useRepoPath();
  const settings = useOpenSettings();
  const dropItem = useDropItem();
  const drop = async () => {
    const result = await dropItem(item);
    if (result.kind === "refused") {
      onRefused(result.message);
    } else if (result.kind === "dropped" && !result.committed) {
      // The spec's edge case: a refused commit keeps the page, with the refusal under the name.
      onRefused(UNCOMMITTED);
    } else if (result.kind === "dropped") {
      addNote(HOME_NOTES, ...result.notes);
      navigate(here("/"));
    }
  };
  const name = item.kind === "change" ? "Change" : "Feature";
  return (
    <ActionsMenu
      items={[
        { label: "Rename", onClick: () => settings(feature) },
        { label: `Drop the ${item.kind}…`, onClick: () => void drop() },
      ]}
      label={`${name} actions`}
    />
  );
}
