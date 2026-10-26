// A workflow document read in panes: its title, the blocks before its first `##`, then each section
// a pane, as the plan's. The documents' column beside it, of Contents and, where the agent can be
// asked, Session; on the phone, in the status line. Selecting blocks and "Ask the agent" quote them
// into the session.
import { Button } from "@astryxdesign/core/Button";

import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import type { useFile } from "./data.ts";
import { documentEntries } from "./document/entries.ts";
import { SectionPane } from "./document/SectionPane.tsx";
import { useAskSelection } from "./document/useAskSelection.tsx";
import { useHashFold } from "./Folds.tsx";
import { Page } from "./layout/Page.tsx";
import { Pane } from "./layout/Pane.tsx";
import { planParts } from "./planParts.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { Selectable, SelectionRoom } from "./Selection.tsx";
import { usePageSession } from "./spec/pageSession.ts";
import { SpecColumn } from "./spec/SpecColumn.tsx";
import { Contents } from "./spec/SpecContents.tsx";
import { Spans } from "./Spans.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

/**
 * A workflow file, drawn from the core's document tree, in panes: a document with no `##` section
 * is one pane, titled by its file's name.
 */
export function DocumentPage({ file }: { file: File }) {
  const here = useRepoPath();
  const session = usePageSession(file);
  const selection = useAskSelection(file, session?.ask);
  const { document } = file.current;
  const { opening, sections } = planParts(document, undefined);
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  const drawing = { document, selection };
  // A link to a section, `discovery-01.md#approaches`, lands on its pane, its anchor the id.
  useHashFold(document, undefined, true);
  const body = opening.map((run) =>
    run.kind === "blocks" ? <Blocks {...drawing} ids={run.ids} key={run.ids[0]} /> : null,
  );
  const page = (
    <Page>
      <Crumbs current={file.name} folder={file.folder} />
      <VStack gap={3}>
        {title && (
          <PageTitle
            actions={
              file.kind === "proposal" && (
                <Button label="Edit" onClick={() => navigate(here(`/edit/${file.path}`))} />
              )
            }
            around={(heading) => (
              <Selectable block={title} selection={selection}>
                {heading}
              </Selectable>
            )}
            id={title.anchor}
          >
            <Spans spans={title.spans} />
          </PageTitle>
        )}
        {sections.length === 0 ? (
          <Pane id="document" isOpenOnPhone title={file.name}>
            <SelectionRoom selection={selection}>{body}</SelectionRoom>
          </Pane>
        ) : (
          <>
            <SelectionRoom selection={selection}>{body}</SelectionRoom>
            {sections.map((section) => (
              <SectionPane drawing={drawing} key={section.heading.id} section={section} />
            ))}
          </>
        )}
      </VStack>
    </Page>
  );
  return (
    <SpecColumn
      content={page}
      contents={<Contents entries={documentEntries(document)} />}
      extra={session ? [session.tab] : []}
      file={file}
      review={undefined}
    />
  );
}
