import { VStack } from "@astryxdesign/core/VStack";
import { useFateClient } from "react-fate";
import { Crumbs } from "./Crumbs.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { PlanPage } from "./PlanPage.tsx";
import { filePage, readAlong } from "./readAhead.ts";
import { RoundPage } from "./RoundPage.tsx";
import { DataModelPage } from "./spec/DataModelPage.tsx";
import { SpecPage } from "./spec/SpecPage.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { StoriesProvider } from "./stories.tsx";
import { Missing } from "./layout/Missing.tsx";

/**
 * A workflow file, on the page its kind needs: a spec, waiting for review or not; a round to
 * answer; a plan, waiting for review or not; a data model, in panes; or a document to read, its
 * story links embedded.
 */
export function FilePage({ folder, name }: { folder: string; name: string }) {
  const fate = useFateClient();
  // A spec's page draws its data model too: read with the spec, not once the spec is in (R85).
  readAlong(fate, name === "spec.md" ? [filePage(folder, "data-model.md")] : []);
  const file = useFile(folder, name);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page kind="rows">
        <VStack gap={3}>
          <Crumbs current={name} folder={folder} />
          <Missing
            label="Open the feature"
            title={`No file ${name} in ${folder}.`}
            to={`/f/${folder}`}
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
  // A round, a data model, and a document draw the file as it is now, with the stories and HTML
  // mockups it embeds: a story gone from an answered round is a variant removed after its answer.
  const round = file.kind === "clarifications";
  return (
    <StoriesProvider
      folder={file.folder}
      mockups={file.current.mockups}
      removed={round && file.status === "answered"}
      stories={file.current.stories}
    >
      {round ? (
        <RoundPage file={file} target={{ folder }} />
      ) : file.kind === "data-model" ? (
        <DataModelPage file={file} />
      ) : (
        <DocumentPage file={file} />
      )}
    </StoriesProvider>
  );
}
