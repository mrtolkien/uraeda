// A feature's `data-model.md` opened alone: its title, then the same panes as the spec's "Data", one
// per entity, from the core's sections.
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "../Blocks.tsx";
import { Crumbs } from "../Crumbs.tsx";
import { Page } from "../layout/Page.tsx";
import { Spans } from "../Spans.tsx";
import { DataPart } from "./DataPart.tsx";
import type { File } from "./parts.ts";

/** A data model, drawn in panes as the spec draws it; as a document if the core did not read it. */
export function DataModelPage({ file }: { file: File }) {
  const { document, items } = file.current;
  const model = items.dataModel;
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  return (
    <Page>
      <Crumbs current={file.name} folder={file.folder} />
      {model ? (
        <VStack gap={3}>
          {title && (
            <Heading level={1}>
              <Spans spans={title.spans} />
            </Heading>
          )}
          <DataPart document={document} level={2} model={model} />
        </VStack>
      ) : (
        <Blocks document={document} />
      )}
    </Page>
  );
}
