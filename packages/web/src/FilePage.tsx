import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { Crumbs } from "./Crumbs.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { PlanPage } from "./PlanPage.tsx";
import { RoundPage } from "./RoundPage.tsx";
import { SpecPage } from "./spec/SpecPage.tsx";
import { useRepoPath, useRestoreScroll } from "./routes.tsx";
import { StoriesProvider } from "./stories.tsx";

/**
 * A workflow file, on the page its kind needs: a spec, waiting for review or not; a round to answer;
 * a plan, waiting for review or not; or a document to read, its story links embedded.
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
          <AnnouncedBanner
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
  if (file.kind === "spec") {
    return <SpecPage file={file} />;
  }
  if (file.kind === "plan") {
    return <PlanPage file={file} />;
  }
  // A round and a document draw the file as it is now, with the stories it embeds: a story gone
  // from an answered round is a variant removed after its answer.
  const round = file.kind === "clarifications";
  return (
    <StoriesProvider
      folder={file.folder}
      mockups={file.current.mockups}
      removed={round && file.status === "answered"}
      stories={file.current.stories}
    >
      {round ? <RoundPage file={file} target={{ folder }} /> : <DocumentPage file={file} />}
    </StoriesProvider>
  );
}
