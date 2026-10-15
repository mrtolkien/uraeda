import { Banner } from "@astryxdesign/core/Banner";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { Crumbs } from "./Crumbs.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { ReviewPage } from "./ReviewPage.tsx";
import { RoundPage } from "./RoundPage.tsx";
import { useRepoPath, useRestoreScroll } from "./routes.tsx";
import { StoriesProvider } from "./stories.tsx";

/**
 * A workflow file, on the page its kind needs: a round to answer, a file to review, or a document to
 * read, its story links embedded.
 */
export function FilePage({ folder, name }: { folder: string; name: string }) {
  const file = useFile(folder, name);
  const here = useRepoPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page>
        <VStack gap={3}>
          <Crumbs current={name} folder={folder} />
          <Banner
            collapsible={false}
            description={
              <Link hasUnderline href={here(`/f/${folder}`)}>
                Open the feature
              </Link>
            }
            status="error"
            title={`No file ${name} in ${folder}.`}
          />
        </VStack>
      </Page>
    );
  }
  const reviewed = ["spec", "plan"].includes(file.kind);
  if (reviewed && file.status === "awaiting-human") {
    return <ReviewPage file={file} />;
  }
  // A round and a document draw the file as it is now, with the stories it embeds.
  return (
    <StoriesProvider folder={file.folder} stories={file.current.stories}>
      {file.kind === "clarifications" ? <RoundPage file={file} target={{ folder }} /> : <DocumentPage file={file} />}
    </StoriesProvider>
  );
}
