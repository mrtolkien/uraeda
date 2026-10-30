// A feature's `data-model.md` opened alone: its title, then the same panes as the spec's "Data",
// one per entity, from the core's sections, beside the documents' column.
import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "../Blocks.tsx";
import { Crumbs } from "../Crumbs.tsx";
import { useHashFold } from "../Folds.tsx";
import { Page } from "../layout/Page.tsx";
import { Spans } from "../Spans.tsx";
import { dataModelEntries, documentEntries } from "../document/entries.ts";
import { usePageSession } from "./pageSession.ts";
import { SpecColumn } from "./SpecColumn.tsx";
import { Contents } from "./SpecContents.tsx";
import { DataPart } from "./DataPart.tsx";
import type { File } from "./parts.ts";
import { PageTitle } from "../layout/PageTitle.tsx";

/** A data model, drawn in panes as the spec draws it; as a document if the core did not read it. */
export function DataModelPage({ file }: { file: File }) {
  const { document, items } = file.current;
  const model = items.dataModel;
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  // A link to an entity, `data-model.md#task`, lands on its pane, the section's anchor its id.
  useHashFold(document, undefined, true);
  const session = usePageSession(file);
  const page = (
    <Page kind="reading">
      <Crumbs current={file.name} folder={file.folder} />
      {model ? (
        <VStack gap={3}>
          {title && (
            <PageTitle>
              <Spans spans={title.spans} />
            </PageTitle>
          )}
          <DataPart document={document} level={2} model={model} prefix="" />
        </VStack>
      ) : (
        <Blocks document={document} />
      )}
    </Page>
  );
  return (
    <SpecColumn
      content={page}
      contents={<Contents entries={model ? dataModelEntries(model) : documentEntries(document)} />}
      extra={session ? [session.tab] : []}
      file={file}
      review={undefined}
    />
  );
}
