// A feature's session in a page's column: the session's view in the box the column scrolls, with
// the way to the session's page.
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, Suspense, useState } from "react";
import { useFeature } from "./data.ts";
import { SideColumn } from "./layout/SideColumn.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useRepoPath, useSearch } from "./routes.tsx";
import type { SessionItem } from "./SessionActions.tsx";
import { SessionAnnouncer } from "./SessionAnnouncer.tsx";
import { sessionPath } from "./sessions.ts";
import { NO_BRANCH, SessionPane } from "./SessionView.tsx";
import type { Draft } from "./useDraft.ts";

/**
 * The feature's latest session, in the column that scrolls it: its header, a link to the session's
 * page, its transcript following its end in the column, and its composer at the column's foot. Before
 * its first message creates the session, the composer alone. `draft` is the composer's text and
 * images, kept by the page, so that the column can go and come back without losing them.
 */
export function ColumnSession({ draft, folder }: { draft: Draft; folder: string }) {
  const feature = useFeature(folder);
  const here = useRepoPath();
  // A session created here shows before the feature's live update names it.
  const [created, setCreated] = useState<string>();
  if (!feature || feature.missing) {
    return null;
  }
  const id = feature.session ?? created;
  const item: SessionItem = {
    branch: feature.branch ?? null,
    folder,
    kind: feature.kind === "change" ? "change" : "feature",
    slug: feature.slug,
  };
  return (
    <>
      <SessionAnnouncer
        feature={folder}
        key={folder}
        {...(id === undefined ? {} : { session: id })}
      />
      <VStack gap={3}>
        <Link hasUnderline href={here(sessionPath(folder))}>
          Open the session&apos;s page
        </Link>
        <SessionPane
          crumbs={folder}
          draft={draft}
          folder={folder}
          isBoxed
          item={item}
          onSent={setCreated}
          title={feature.title}
          {...(id === undefined ? {} : { id })}
          {...(feature.branch ? {} : { blocked: NO_BRANCH })}
        />
      </VStack>
    </>
  );
}

/**
 * A page of a feature's documents, `children`, with the feature's session in a column beside it on
 * wide and semi-wide screens, while the address says `?tab=session`: foldable with `]`, resizable,
 * at least 400 px wide.
 */
// TEMPORARY: the questions page's document column replaces this, as a tab beside Outline and Notes.
export function WithSessionColumn({
  children,
  draft,
  folder,
  isAvailable,
}: {
  children: ReactNode;
  draft: Draft;
  folder: string;
  /** Whether the feature's agent can be asked here: a feature's round, its agent available. */
  isAvailable: boolean;
}) {
  const wide = !isNarrow(useWidthClass());
  const tab = new URLSearchParams(useSearch()).get("tab");
  const [shown, setShown] = useState(true);
  if (!isAvailable || !wide || tab !== "session") {
    return <>{children}</>;
  }
  return (
    <SideColumn
      content={children}
      isShown={shown}
      label="Session"
      onShownChange={setShown}
      sizes={{ default: 480, min: 400 }}
      storageKey="uraeda.roundColumn"
    >
      <Suspense fallback={null}>
        <ColumnSession draft={draft} folder={folder} />
      </Suspense>
    </SideColumn>
  );
}
