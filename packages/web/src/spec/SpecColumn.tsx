// The spec's and the plan's column: on wide and semi-wide screens, the questions page's document
// column, of Contents, then Review while a review waits, then the page's other tabs; on the phone,
// no column, but the status line's Contents, the comments' count, and Verdict, the first two
// opening the same panels in sheets, Verdict bringing the page's end into view, or, with no review,
// Session, opening the session's page.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { type ReactNode, useState } from "react";
import { type ColumnTab, DocumentColumn } from "../layout/DocumentColumn.tsx";
import { Overlay } from "../layout/Overlay.tsx";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { Review } from "../review/useReview.tsx";
import { ColumnGo } from "./columnGo.ts";
import type { File } from "./parts.ts";
import { ReviewTab } from "./ReviewTab.tsx";
import { toVerdict } from "../ReviewVerdict.tsx";
import { afterSheetCloses } from "../roundJump.ts";
import { navigateHere } from "../routes.tsx";
import { sessionPath } from "../sessions.ts";

/** The phone's sheet open over the page, if any. */
type Sheet = "contents" | "review" | undefined;

/** "N comments", the count read out after its number. */
function Count({ count }: { count: number }) {
  return (
    <>
      {count}
      <VisuallyHidden> {count === 1 ? "comment" : "comments"}</VisuallyHidden>
    </>
  );
}

/**
 * On the phone, the column's panels outside the page: the status line's Contents, the comments'
 * count and Verdict while a review waits, Contents and the count each opening its panel in a sheet;
 * with no review, Session, opening the session's page of `session`, the feature's folder, where the
 * page has a Session tab.
 */
function PhoneParts({
  contents,
  review,
  session,
}: {
  contents: ReactNode;
  review: { count: number; panel: ReactNode } | undefined;
  session: string | undefined;
}) {
  const [sheet, setSheet] = useState<Sheet>();
  const close = () => setSheet(undefined);
  const go = (run: () => void) => {
    close();
    afterSheetCloses(run);
  };
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
                label={`${review.count} ${review.count === 1 ? "comment" : "comments"}`}
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
              icon={<Icon icon="uraeda:comment" />}
              label="Session"
              onClick={() => navigateHere(sessionPath(session))}
              variant="ghost"
            />
          )}
        </HStack>
      </TopBarSlot>
      <ColumnGo value={go}>
        {/* No field to type in: the sheet needs no room for a keyboard, and the page shows above. */}
        <Overlay
          isOpen={sheet === "contents"}
          label="Contents"
          onClose={close}
          sheetHeight="capped"
        >
          {contents}
        </Overlay>
        {review && (
          <Overlay isOpen={sheet === "review"} label="Review" onClose={close}>
            {review.panel}
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
  const tabs: Array<ColumnTab> = [
    { icon: "uraeda:list", key: "contents", label: "Contents", panel: contents },
    ...(review
      ? [
          {
            ...(count > 0 ? { badge: <Count count={count} /> } : {}),
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
          session={extra.some((tab) => tab.key === "session") ? file.folder : undefined}
        />
      )}
    </>
  );
}
