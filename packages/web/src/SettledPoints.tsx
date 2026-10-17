import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Block, Document, SettledGroup, SettledPoint } from "uraeda-binding";
import { topBlock } from "./Folds.tsx";
import { Blocks } from "./Blocks.tsx";
import type { useFile } from "./data.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useRepositoryPath } from "./routes.tsx";
import {
  AnsweredNotices,
  afterRemoval,
  type Open,
  restoredForm,
  SettledForm,
  SettledNote,
} from "./SettledForm.tsx";
import { SettledGroups } from "./SettledGroups.tsx";
import { useSettledWrites } from "./settledWrites.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  inline: {
    // The comment form under its point on wide screens.
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlock: spacingVars["--spacing-2"],
    padding: spacingVars["--spacing-3"],
  },
});

/**
 * The comment form open on a round's settled points, `shown` while the round awaits the human, and
 * the writes it makes: the one holding unsaved text when the page is drawn opens again, and a
 * write done or a removal closes or follows it.
 */
function useSettledForm(file: File, readOnly: boolean) {
  const repo = useRepositoryPath();
  const round = file.current.items.clarifications;
  const [open, setOpen] = useState<Open | undefined>(() =>
    readOnly
      ? undefined
      : restoredForm(repo, file.path, round?.settledPoints ?? [], round?.settledComments ?? []),
  );
  const writes = useSettledWrites(
    file,
    () => setOpen(undefined),
    (number) => setOpen(afterRemoval(number)),
  );
  const shown = readOnly ? undefined : open;
  const form = shown && (
    <SettledForm
      onClose={() => setOpen(undefined)}
      path={file.path}
      shown={shown}
      writes={writes}
    />
  );
  return { form, setOpen, shown, writes };
}

/** Whether a point lies under "Under the hood". */
function inHood(document: Document, groups: ReadonlyArray<SettledGroup>, point: SettledPoint) {
  const top = topBlock(document, document.blocks[point.block])?.id;
  const hood = groups.find((group) => group.kind === "hood");
  return top !== undefined && hood !== undefined && hood.blocks.includes(top);
}

/**
 * The points a round settled without the human, in their groups, with their comments under them.
 * While the round awaits the human, a point that starts in bold is tapped to comment on it, in a
 * form under it on wide screens and in a sheet on the phone, and its comments have Edit and
 * Remove. Each form's text is kept in the unsaved store; the one holding text when the page is
 * drawn opens again, "Under the hood" opened for it.
 */
export function SettledPoints({ file, readOnly }: { file: File; readOnly: boolean }) {
  const wide = useWidthClass() === "wide";
  const round = file.current.items.clarifications;
  const document = file.current.document;
  const points = round?.settledPoints ?? [];
  const comments = round?.settledComments ?? [];
  const { form, setOpen, shown, writes } = useSettledForm(file, readOnly);
  if (!round || round.settledGroups.length === 0) {
    return null;
  }

  const inPage = (here: boolean) =>
    wide && here && <div {...stylex.props(styles.inline)}>{form}</div>;
  const pointOf = (block: Block) => points.find((p) => p.block === block.id);
  /** Whether the new comment's form is open on this block's point: by subject, as blocks move. */
  const newOn = (block: Block) =>
    shown?.kind === "new" && pointOf(block)?.subject === shown.point.subject;
  // A point that left the round while its form was open: the form stays, after the points.
  const gone = shown !== undefined && !points.some((p) => p.subject === shown.point.subject);

  /** A point's comments, and its form on wide screens. */
  const after = (block: Block): ReactNode => {
    const point = pointOf(block);
    if (!point) {
      return null;
    }
    return (
      <>
        {comments
          .filter((comment) => comment.point === block.id)
          .map((comment) =>
            shown?.kind === "edit" && shown.comment.number === comment.number ? (
              <div key={comment.number}>{inPage(true)}</div>
            ) : (
              <SettledNote
                comment={comment}
                key={comment.number}
                onEdit={() => setOpen({ comment, kind: "edit", point })}
                point={point}
                readOnly={readOnly}
                writes={writes}
              />
            ),
          )}
        {readOnly && <AnsweredNotices comments={comments} path={file.path} point={point} />}
        {inPage(newOn(block))}
      </>
    );
  };
  const selection = {
    after,
    canSelect: (block: Block) => !readOnly && pointOf(block) !== undefined,
    isSelected: newOn,
    onTap: (block: Block) => {
      const point = pointOf(block);
      if (point && !newOn(block)) {
        setOpen({ kind: "new", point });
      }
    },
  };

  return (
    <>
      <SettledGroups
        document={document}
        groups={round.settledGroups}
        hoodForced={shown !== undefined && inHood(document, round.settledGroups, shown.point)}
        points={(group) => <Blocks document={document} ids={group.blocks} selection={selection} />}
      />
      {inPage(gone)}
      {!wide && !readOnly && (
        <Overlay
          isOpen={shown !== undefined}
          label="Comment"
          onClose={() => setOpen(undefined)}
          sheetHeight="capped"
        >
          {form}
        </Overlay>
      )}
    </>
  );
}
