import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, use } from "react";
import type { CommentItem } from "uraeda-binding";
import type { useFile } from "./data.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { where } from "./ReviewComments.tsx";
import { Band } from "./ReviewHeadings.tsx";
import { type Refusals, ReviewVerdict } from "./ReviewVerdict.tsx";
import { ReviewImagesContext } from "./useReviewImages.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

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
      title={`The ${kind} changed since your comments: your ${count} pending ${
        count === 1 ? "comment is" : "comments are"
      } on the previous version. Adding a comment replaces it.`}
    />
  );
}

/**
 * The review's own part, after the file: its comments, each where it points, the general ones
 * with Edit and Remove, a general comment's field, and the verdict, which the comment being written
 * may hold back.
 */
export function YourReview({
  comments,
  file,
  general,
  onGeneral,
  pendingNote,
  refusals,
  wide,
}: {
  comments: ReadonlyArray<CommentItem>;
  file: File;
  general: ReactNode;
  onGeneral: () => void;
  pendingNote: (comment: CommentItem) => ReactNode;
  refusals: Refusals;
  wide: boolean;
}) {
  const images = use(ReviewImagesContext);
  return (
    <>
      <Band wide={wide} />
      <Heading level={2}>Your review</Heading>
      {comments.length === 0 && (
        <Text color="secondary" type="supporting">
          No comment yet.
        </Text>
      )}
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
      <HStack gap={2}>
        <Button label="Add a general comment" onClick={onGeneral} />
      </HStack>
      {general}
      <ReviewVerdict
        comments={comments.length}
        file={file}
        refusals={{ ...refusals, hides: images?.hides, hold: images?.hold }}
      />
    </>
  );
}
