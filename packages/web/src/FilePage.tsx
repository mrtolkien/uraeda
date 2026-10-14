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

/** A workflow file, on the page its kind needs: a round to answer, or a document to read. */
export function FilePage({ folder, name }: { folder: string; name: string }) {
  const file = useFile(folder, name);
  const here = useRepoPath();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page>
        <VStack gap={3}>
          <Crumbs folder={folder} current={name} />
          <Banner
            status="error"
            title={`No file ${name} in ${folder}.`}
            collapsible={false}
            description={
              <Link href={here(`/f/${folder}`)} hasUnderline>
                Open the feature
              </Link>
            }
          />
        </VStack>
      </Page>
    );
  }
  if (file.kind === "clarifications") {
    return <RoundPage file={file} />;
  }
  const reviewed = ["spec", "plan", "assessment"].includes(file.kind);
  if (reviewed && file.status === "awaiting-human") {
    return <ReviewPage file={file} />;
  }
  return <DocumentPage file={file} />;
}
