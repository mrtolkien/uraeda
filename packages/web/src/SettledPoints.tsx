import { Heading } from "@astryxdesign/core/Heading";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Block } from "uraeda-binding";
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
  title: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/**
 * The points a round settled without the human, with their comments under them. While the round
 * awaits the human, a point that starts in bold is tapped to comment on it, in a form under it on
 * wide screens and in a sheet on the phone, and its comments have Edit and Remove. Each form's
 * text is kept in the unsaved store; the one holding text when the page is drawn opens again.
 */
export function SettledPoints({ file, readOnly }: { file: File; readOnly: boolean }) {
  const wide = useWidthClass() === "wide";
  const repo = useRepositoryPath();
  const round = file.current.items.clarifications;
  const points = round?.settledPoints ?? [];
  const comments = round?.settledComments ?? [];
  const [open, setOpen] = useState<Open | undefined>(() =>
    readOnly ? undefined : restoredForm(repo, file.path, points, comments),
  );
  const writes = useSettledWrites(
    file,
    () => setOpen(undefined),
    (number) => setOpen(afterRemoval(number)),
  );
  if (!round || round.settledGroups.length === 0) {
    return null;
  }
  const shown = readOnly ? undefined : open;

  const form = shown && (
    <SettledForm
      onClose={() => setOpen(undefined)}
      path={file.path}
      shown={shown}
      writes={writes}
    />
  );
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

  return (
    <>
      <Heading level={2} xstyle={styles.title}>
        Settled without you
      </Heading>
      <Blocks
        document={file.current.document}
        ids={round.settledGroups.flatMap((group) => [group.heading, ...group.blocks])}
        selection={{
          after,
          canSelect: (block) => !readOnly && pointOf(block) !== undefined,
          isSelected: newOn,
          onTap: (block) => {
            const point = pointOf(block);
            if (point && !newOn(block)) {
              setOpen({ kind: "new", point });
            }
          },
        }}
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
