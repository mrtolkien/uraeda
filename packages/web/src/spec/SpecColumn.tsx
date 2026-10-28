// The spec's and the plan's column: on wide and semi-wide screens, the questions page's document
// column, of Contents, then the page's other tabs, the review's being at the page's end; on the
// phone, no column, but the bottom bar's tiles, as a round's: Contents, the comments, and Session,
// each opening its panel in a sheet, then Verdict, bringing the page's end into view.
import type { ReactNode } from "react";
import { type ColumnPanel, DocumentColumn } from "../layout/DocumentColumn.tsx";
import { type ColumnSheet, ColumnStatusLine } from "../layout/ColumnStatusLine.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { Review } from "../review/useReview.tsx";
import { ColumnGo } from "./columnGo.ts";
import { commentsLabel } from "./CommentCount.tsx";
import type { File } from "./parts.ts";
import { ReviewTab } from "./ReviewTab.tsx";
import { toVerdict } from "../ReviewVerdict.tsx";
import { useSheetTab } from "../layout/useSheetTab.ts";
import { afterOverlayCloses } from "../layout/Overlay.tsx";

/** The phone's sheets of the spec's and the plan's column, by their tab's key. */
const SHEETS = { contents: "Contents", review: "Review", session: "Session" } as const;

/**
 * On the phone, the column's panels outside the page, in the bottom bar by their icons, as a
 * round's: Contents; the comments while a review waits; and `session`, the Session tab, where the
 * page has one; each opening its panel in a sheet, kept in the address (`useSheetTab`, R22); then
 * Verdict while a review waits, bringing the page's end into view.
 */
function PhoneParts({
  contents,
  review,
  session,
}: {
  contents: ReactNode;
  review: { count: number; panel: ReactNode } | undefined;
  session: ColumnPanel | undefined;
}) {
  const sheet = useSheetTab(
    {
      contents: SHEETS.contents,
      ...(review ? { review: SHEETS.review } : {}),
      ...(session ? { session: SHEETS.session } : {}),
    },
    true,
  );
  const [open, setSheet] = sheet;
  const close = () => setSheet();
  // A jump from the sheet `label`: once it closed, and the page can scroll again.
  const goFrom = (label: string) => (run: () => void) => {
    close();
    afterOverlayCloses(label, run, { scrolls: true });
  };
  const buttons = (
    <NavTiles label={`The ${review ? "review's" : "page's"} parts`}>
      <NavTile
        icon="uraeda:list"
        isOpen={open === "contents"}
        label="Contents"
        onPress={() => setSheet("contents")}
      />
      {review && (
        <NavTile
          icon="uraeda:comment"
          isOpen={open === "review"}
          label={commentsLabel(review.count)}
          onPress={() => setSheet("review")}
        />
      )}
      {session && (
        <NavTile
          icon={session.icon}
          isOpen={open === "session"}
          label="Session"
          onPress={() => setSheet("session")}
        />
      )}
      {review && <NavTile icon="uraeda:badge-check" isTinted label="Verdict" onPress={toVerdict} />}
    </NavTiles>
  );
  // No field to type in Contents: its sheet needs no room for a keyboard, the page showing above.
  const sheets: Array<ColumnSheet> = [
    {
      height: "capped",
      key: "contents",
      label: SHEETS.contents,
      panel: <ColumnGo value={goFrom(SHEETS.contents)}>{contents}</ColumnGo>,
    },
    ...(review
      ? [
          {
            key: "review",
            label: SHEETS.review,
            panel: <ColumnGo value={goFrom(SHEETS.review)}>{review.panel}</ColumnGo>,
          },
        ]
      : []),
    ...(session ? [{ key: "session", label: SHEETS.session, panel: session.content }] : []),
  ];
  return <ColumnStatusLine buttons={buttons} sheet={sheet} sheets={sheets} />;
}

/**
 * The page of `file`, `content`, with its column: `contents`, the Contents panel, first and open;
 * then `extra`, the page's other tabs, Session among them. The review is at the page's end, its
 * comments and verdict there: the column has no tab for it. On the phone, the bottom bar's tiles
 * instead (see `PhoneParts`).
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
  extra?: ReadonlyArray<ColumnPanel>;
  file: File;
  review: Review | undefined;
}) {
  const wide = !isNarrow(useWidthClass());
  const reviewPanel = review && <ReviewTab review={review} />;
  const count = review?.comments.length ?? 0;
  const session = extra.find((tab) => tab.key === "session");
  const panels: Array<ColumnPanel> = [
    { content: contents, icon: "uraeda:list", key: "contents", label: "Contents" },
    ...extra,
  ];
  return (
    <>
      <DocumentColumn content={content} label={`The ${file.kind}'s column`} panels={panels} />
      {!wide && (
        <PhoneParts
          contents={contents}
          review={review && { count, panel: reviewPanel }}
          session={session}
        />
      )}
    </>
  );
}
