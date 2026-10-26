// The shell's cards: a feature's or a change's, which opens its page, its status what it asks, and
// its "…" its settings; and a session's, whose "…" renames or archives it.
import { Suspense } from "react";
import { useFateClient } from "react-fate";
import { useBranchChanges } from "../data.ts";
import { navigate, sessionIdPath, useRepoPath } from "../routes.tsx";
import { SessionView } from "../views.ts";
import { usePendingAction } from "../writes/store.ts";
import { type Feature, type Row, sessionCard, statusPath, toCard } from "./cards.ts";
import type { Entry } from "./entries.ts";
import { useOpenSettings } from "./FeatureSettingsDialog.tsx";
import { type CardItem, ItemCard } from "./ItemCard.tsx";
import { useOpenRename } from "./RenameSession.tsx";
import { selects } from "./Row.tsx";

/** A feature's or a change's card, with the lines its branch changed once read. */
function FeatureCard({
  feature,
  pathname,
  row,
}: {
  feature: Feature;
  pathname: string;
  row: Row | undefined;
}) {
  const here = useRepoPath();
  const settings = useOpenSettings();
  const to = `/f/${feature.folder}`;
  const card = (item: CardItem) => (
    <ItemCard
      href={here(to)}
      isSelected={selects(pathname, to)}
      item={item}
      onOpen={() => navigate(here(to))}
      onSettings={() => settings(feature)}
      onStatus={() => navigate(here(statusPath(feature, item.status)))}
    />
  );
  const base = toCard(feature, row);
  // What a button just started for it, until the server's status for it changes.
  const pending = usePendingAction(feature.folder, `${base.status.status} ${base.status.label}`);
  const item = pending === undefined ? base : { ...base, pending };
  return (
    <Suspense fallback={card(item)}>
      <WithChanges folder={feature.folder} item={item} render={card} />
    </Suspense>
  );
}

/** The card with its branch's lines added and removed, when it changed any. */
function WithChanges({
  folder,
  item,
  render,
}: {
  folder: string;
  item: CardItem;
  render: (item: CardItem) => React.ReactNode;
}) {
  const changes = useBranchChanges(folder)?.changes;
  return render(
    changes && (changes.added > 0 || changes.removed > 0)
      ? { ...item, changes: { added: changes.added, removed: changes.removed } }
      : item,
  );
}

/** A session's card: its "…" renames it, and archives it or brings it back. */
function SessionCard({ pathname, row }: { pathname: string; row: Row }) {
  const here = useRepoPath();
  const fate = useFateClient();
  const rename = useOpenRename();
  const to = sessionIdPath(row.id);
  return (
    <ItemCard
      actions={[
        { label: "Rename", onClick: () => rename(row) },
        {
          label: row.archived ? "Unarchive" : "Archive",
          onClick: () =>
            void fate.mutations.session.archive({
              input: { archived: !row.archived, session: row.id },
              view: SessionView,
            }),
        },
      ]}
      href={here(to)}
      isSelected={selects(pathname, to)}
      item={sessionCard(row)}
      onOpen={() => navigate(here(to))}
    />
  );
}

/** An entry's card, by its kind. */
export function EntryCard({ entry, pathname }: { entry: Entry; pathname: string }) {
  return entry.kind === "feature" ? (
    <FeatureCard feature={entry.feature} pathname={pathname} row={entry.row} />
  ) : (
    <SessionCard pathname={pathname} row={entry.row} />
  );
}
