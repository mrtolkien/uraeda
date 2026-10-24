// The spec's and the plan's column: on wide and semi-wide screens, the questions page's document
// column, of Contents, then Review while a review waits, then the page's other tabs; on the phone,
// no column, but the status line's Contents, the comments' count, and Verdict, the first two
// opening the same panels in sheets, Verdict bringing the page's end into view, or, with no review,
// Session, opening the session's page.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import type { ReactNode } from "react";
import { type ColumnTab, DocumentColumn } from "../layout/DocumentColumn.tsx";
import { Overlay } from "../layout/Overlay.tsx";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { Review } from "../review/useReview.tsx";
import { ColumnGo, ColumnVerdict } from "./columnGo.ts";
import { CommentCount, commentsLabel } from "./CommentCount.tsx";
import type { File } from "./parts.ts";
import { ReviewTab } from "./ReviewTab.tsx";
import { toVerdict } from "../ReviewVerdict.tsx";
import { afterOverlayCloses } from "../layout/useBackCloses.ts";
import { afterSheetCloses } from "../roundJump.ts";
import { navigateHere } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";
import { SHEETS, useSheetTab } from "./useSheetTab.ts";

/**
 * On the phone, the column's panels outside the page: the status line's Contents, the comments'
 * count and Verdict while a review waits, Contents and the count each opening its panel in a sheet,
 * kept in the address (`useSheetTab`);
 * with no review, Session, with the Session tab's icon, opening the session's page of `session`'s
 * folder, the feature's, where the page has a Session tab.
 */
function PhoneParts({
  contents,
  review,
  session,
}: {
  contents: ReactNode;
  review: { count: number; panel: ReactNode } | undefined;
  session: { folder: string; icon: ColumnTab["icon"] } | undefined;
}) {
  const [sheet, setSheet] = useSheetTab(review !== undefined);
  const close = () => setSheet();
  const go = (run: () => void) => {
    close();
    afterSheetCloses(run);
  };
  const commit = (verdict: () => Promise<boolean>) =>
    new Promise<boolean>((resolve) => {
      close();
      afterOverlayCloses(SHEETS.review, async () => {
        const done = await verdict();
        if (!done) {
          setSheet("review");
        }
        resolve(done);
      });
    });
  return (
    <>
      <TopBarSlot>
        <HStack align="center" gap={1}>
          <Button
            icon={<Icon icon="uraeda:list" />}
            label="Contents"
            onClick={() => setSheet("contents")}
            variant="ghost"
          />
          {review && (
            <>
              <Button
                icon={<Icon icon="uraeda:comment" />}
                label={commentsLabel(review.count)}
                onClick={() => setSheet("review")}
                variant="ghost"
              >
                {review.count}
              </Button>
              <Button label="Verdict" onClick={toVerdict} variant="primary" />
            </>
          )}
          {!review && session !== undefined && (
            <Button
              icon={<Icon icon={session.icon} />}
              label="Session"
              onClick={() => navigateHere(sessionPath(session.folder))}
              variant="ghost"
            />
          )}
        </HStack>
      </TopBarSlot>
      <ColumnGo value={go}>
        {/* No field to type in: the sheet needs no room for a keyboard, the page showing above. */}
        <Overlay
          isOpen={sheet === "contents"}
          label={SHEETS.contents}
          onClose={close}
          sheetHeight="capped"
        >
          {contents}
        </Overlay>
        {review && (
          <Overlay isOpen={sheet === "review"} label={SHEETS.review} onClose={close}>
            <ColumnVerdict value={commit}>{review.panel}</ColumnVerdict>
          </Overlay>
        )}
      </ColumnGo>
    </>
  );
}

/**
 * The page of `file`, `content`, with its column: `contents`, the Contents panel, first and open;
 * while `review` waits, its Review tab, the pending comments counted in its badge; then `extra`,
 * the page's other tabs, Session among them. On the phone, the status line's parts instead (see
 * `PhoneParts`).
 */
export function SpecColumn({
  content,
  contents,
  extra = [],
  file,
  review,
}: {
  content: ReactNode;
  contents: ReactNode;
  extra?: ReadonlyArray<ColumnTab>;
  file: File;
  review: Review | undefined;
}) {
  const wide = !isNarrow(useWidthClass());
  const reviewPanel = review && <ReviewTab file={file} review={review} />;
  const count = review?.comments.length ?? 0;
  const session = extra.find((tab) => tab.key === "session");
  const tabs: Array<ColumnTab> = [
    { icon: "uraeda:list", key: "contents", label: "Contents", panel: contents },
    ...(review
      ? [
          {
            ...(count > 0 ? { badge: <CommentCount count={count} /> } : {}),
            icon: "uraeda:comment" as const,
            key: "review",
            label: "Review",
            panel: reviewPanel,
          },
        ]
      : []),
    ...extra,
  ];
  return (
    <>
      <DocumentColumn content={content} label={`The ${file.kind}'s column`} tabs={tabs} />
      {!wide && (
        <PhoneParts
          contents={contents}
          review={review && { count, panel: reviewPanel }}
          session={session && { folder: file.folder, icon: session.icon }}
        />
      )}
    </>
  );
}
