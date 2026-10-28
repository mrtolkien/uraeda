import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, use, useState } from "react";
import type { CommentItem } from "uraeda-binding";
import { CommentForm } from "./CommentForm.tsx";
import type { useFile } from "./data.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { where } from "./ReviewComments.tsx";
import { type ChoicesState, type Refusals, ReviewVerdict } from "./ReviewVerdict.tsx";
import { ReviewImagesContext } from "./useReviewImages.ts";
import { Empty } from "./layout/Empty.tsx";
import { plural } from "./labels.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  band: {
    // A band before the review's end, to the screen's edges on the phone.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
  },
  bandBleed: {
    // The page's inset, taken back (see `Page`).
    marginInline: "var(--page-bleed)",
  },
});

/** The band before a review's end, to the screen's edges on the phone. */
function Band({ wide }: { wide: boolean }) {
  return <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />;
}

/** Says that the file changed under the pending comments, with Start over. */
export function StaleBanner({
  count,
  kind,
  onStartOver,
}: {
  count: number;
  kind: string;
  onStartOver: () => Promise<void>;
}) {
  return (
    <Banner
      endContent={<Button clickAction={onStartOver} label="Start over" />}
      status="warning"
      title={`The ${kind} changed since your comments: your ${plural(count, "pending comment")} ${
        count === 1 ? "is" : "are"
      } on the previous version. Adding a comment replaces it.`}
    />
  );
}

/** The id of the end's general comment, whose field the Review sheet's button focuses. */
export const GENERAL_ID = "review-general";

/**
 * A general comment's field, always at the review's end, its text kept in the unsaved store:
 * "Add comment" writes it, and the field is empty again for the next one; Cancel empties it.
 */
function GeneralComment({
  file,
  onAdd,
}: {
  file: File;
  onAdd: (text: string) => Promise<string | undefined>;
}) {
  // A new field for each comment written: the one written leaves it.
  const [written, setWritten] = useState(0);
  return (
    <div id={GENERAL_ID}>
      <CommentForm
        anchor="General comment"
        field={`${file.path}#general`}
        key={written}
        onCancel={() => setWritten((count) => count + 1)}
        onSubmit={async (text) => {
          const error = await onAdd(text);
          if (error === undefined) {
            setWritten((count) => count + 1);
          }
          return error;
        }}
      />
    </div>
  );
}

/** The verdict of a review, which the comment being written, and its images, may hold back. */
export function YourVerdict({
  choices,
  comments,
  file,
  refusals,
}: {
  choices: ChoicesState;
  /** How many comments are pending. */
  comments: number;
  file: File;
  refusals: Refusals;
}) {
  const images = use(ReviewImagesContext);
  return (
    <ReviewVerdict
      choices={choices}
      comments={comments}
      file={file}
      refusals={{ ...refusals, hides: images?.hides, hold: images?.hold }}
    />
  );
}

/**
 * The review's own part, after the file: its comments, each where it points, the general ones
 * with Edit and Remove, `general`, what an edit of one shows, a general comment's field, always
 * there but while `isGeneralOpen`, the review's own general draft taking its place, as an image
 * dropped with no comment open starts it, and the verdict, unless `hasVerdict` is false, when the
 * page shows it elsewhere.
 */
export function YourReview({
  choices,
  comments,
  file,
  general,
  hasVerdict = true,
  isGeneralOpen,
  onGeneral,
  pendingNote,
  refusals,
  wide,
}: {
  choices: ChoicesState;
  comments: ReadonlyArray<CommentItem>;
  file: File;
  general: ReactNode;
  hasVerdict?: boolean;
  /** Whether the review's general draft is open: one general comment's form at a time. */
  isGeneralOpen: boolean;
  /** Adds a general comment: the error to show, or nothing once written. */
  onGeneral: (text: string) => Promise<string | undefined>;
  pendingNote: (comment: CommentItem) => ReactNode;
  refusals: Refusals;
  wide: boolean;
}) {
  return (
    <>
      <Band wide={wide} />
      <Heading level={2}>Your review</Heading>
      {comments.length === 0 && <Empty>No comment yet.</Empty>}
      {comments.map((comment) =>
        // A general comment has no block to show under: it is edited and removed here.
        comment.general ? (
          pendingNote(comment)
        ) : (
          <VStack gap={0} key={comment.number}>
            <Text color="secondary" type="supporting">
              {where(comment)}
            </Text>
            <Paragraph>{comment.text}</Paragraph>
          </VStack>
        ),
      )}
      {general}
      {!isGeneralOpen && <GeneralComment file={file} onAdd={onGeneral} />}
      {hasVerdict && (
        <YourVerdict choices={choices} comments={comments.length} file={file} refusals={refusals} />
      )}
    </>
  );
}
