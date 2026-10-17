import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import type { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { reviewHeadings } from "./ReviewHeadings.tsx";
import { ReviewEnd, ReviewHost, ReviewIntro, useReview } from "./review/useReview.tsx";
import { StoriesProvider } from "./stories.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * A plan to review, as committed at its branch's tip: tapping blocks selects lines to comment on,
 * pending comments show under their blocks, and the end of the page holds the verdict. The comment
 * field opens under the last tapped block on wide screens, and in a sheet on the phone, the block
 * kept in view above it. The field is drawn apart from the document, by `CommentHost`, so typing
 * renders the field alone; the comment holding unsaved text when the page is drawn opens again.
 */
export function ReviewPage({ file }: { file: File }) {
  const wide = useWidthClass() === "wide";
  const review = useReview(file, wide);
  const { folds, selection, storyComments, tree, version } = review;
  return (
    <ReviewHost file={file} review={review}>
      <Page>
        <Crumbs current={file.name} folder={file.folder} />
        <VStack gap={3}>
          <ReviewIntro file={file} review={review} />
          <StoriesProvider comment={storyComments} folder={file.folder} stories={version.stories}>
            <Blocks
              document={tree}
              folds={folds}
              override={reviewHeadings(version.items, wide)}
              selection={selection}
            />
          </StoriesProvider>
          <ReviewEnd file={file} review={review} />
        </VStack>
      </Page>
    </ReviewHost>
  );
}
