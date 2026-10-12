import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Crumbs } from "./Crumbs.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { ReviewPage } from "./ReviewPage.tsx";
import { RoundPage } from "./RoundPage.tsx";
import { useRestoreScroll } from "./routes.tsx";

/** A workflow file, on the page its kind needs: a round to answer, or a document to read. */
export function FilePage({ folder, name }: { folder: string; name: string }) {
  const file = useFile(folder, name);
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  if (!file || file.missing) {
    return (
      <Page>
        <Crumbs folder={folder} current={name} />
        <VStack gap={2}>
          <Text as="p" display="block">
            No file {name} in {folder}.
          </Text>
          <Text as="p" display="block">
            <Link href={`/f/${folder}`}>Open the feature</Link>
          </Text>
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
