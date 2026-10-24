// A feature's session in a page's column: the session's view in the box the column scrolls, with
// the way to the session's page.
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useFeature } from "./data.ts";
import { useRepoPath } from "./routes.tsx";
import type { SessionItem } from "./SessionActions.tsx";
import { SessionAnnouncer } from "./SessionAnnouncer.tsx";
import { sessionPath } from "./sessions.ts";
import { NO_BRANCH, SessionPane } from "./SessionView.tsx";
import type { Draft } from "./useDraft.ts";

/**
 * The feature's latest session, in the column that scrolls it: its header, a link to the session's
 * page, its transcript following its end in the column, and its composer at the column's foot. Before
 * its first message creates the session, the composer alone. `draft` is the composer's text and
 * images, the feature's, which the session's page holds too, so that the column can go and come
 * back, and the human go to the session's page and back, without losing them.
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
