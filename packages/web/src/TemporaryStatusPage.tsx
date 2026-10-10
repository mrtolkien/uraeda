// TEMPORARY: replaced by the web UI feature.
// Lists every feature folder with the status of its workflow files: a thin slice that proves the
// stack end to end, not the web UI's design.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { Stack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { useListView, useRequest, useView, view, type ViewRef } from "react-fate";
import type { SpecFolder } from "uraeda-server/fate";

// TEMPORARY: replaced by the web UI feature.
const TemporarySpecFolderView = view<SpecFolder>()({
  id: true,
  name: true,
  files: true,
});

// TEMPORARY: replaced by the web UI feature.
const TemporarySpecFoldersView = {
  items: { node: TemporarySpecFolderView },
};

// TEMPORARY: replaced by the web UI feature.
export function TemporaryStatusPage() {
  const { specFolders } = useRequest({ specFolders: { list: TemporarySpecFoldersView } });
  const [folders] = useListView(TemporarySpecFoldersView, specFolders);

  if (!folders.length) {
    return <Text color="secondary">No feature folders in specs/</Text>;
  }
  return (
    <Stack gap={6}>
      {folders.map(({ node }) => (
        <TemporaryFolder key={node.id} folder={node} />
      ))}
    </Stack>
  );
}

// TEMPORARY: replaced by the web UI feature.
function TemporaryFolder({ folder: folderRef }: { folder: ViewRef<"SpecFolder"> }) {
  const folder = useView(TemporarySpecFolderView, folderRef);

  return (
    <Stack gap={2}>
      <Heading level={2}>{folder.name}</Heading>
      {folder.files.length ? (
        folder.files.map((file) => (
          <Stack key={file.file} direction="horizontal" gap={3}>
            <Text type="code">{file.file}</Text>
            {file.status ? (
              <Badge
                variant={file.status === "awaiting-human" ? "warning" : "neutral"}
                label={file.status}
              />
            ) : (
              <Badge variant="error" label={`Invalid: ${file.problem}`} />
            )}
          </Stack>
        ))
      ) : (
        <Text color="secondary">No workflow files yet</Text>
      )}
    </Stack>
  );
}
