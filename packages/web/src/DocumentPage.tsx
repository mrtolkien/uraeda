import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import type { useFile } from "./data.ts";
import { Page } from "./layout/Page.tsx";
import { navigate, useRepoPath } from "./routes.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  actions: {
    marginBlockEnd: spacingVars["--spacing-4"],
  },
});

/** A workflow file, drawn from the core's document tree. */
export function DocumentPage({ file }: { file: File }) {
  const here = useRepoPath();
  return (
    <Page>
      <Crumbs folder={file.folder} current={file.name} />
      {file.kind === "proposal" && (
        <HStack gap={2} xstyle={styles.actions}>
          <Button label="Edit" onClick={() => navigate(here(`/edit/${file.path}`))} />
        </HStack>
      )}
      <Blocks document={file.current.document} />
    </Page>
  );
}
