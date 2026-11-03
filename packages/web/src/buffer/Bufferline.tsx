// The buffer's top line, as Neovim's bufferline shows the open file: its folders, its name after
// a file's icon, and a dot while its text is not saved. One buffer at a time: no list of buffers.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";

/** The file at `path`, from the top level, as the page's heading; `isDirty` while unsaved. */
export function Bufferline({ isDirty, path }: { isDirty: boolean; path: string }) {
  const folders = path.split("/");
  const name = folders.pop() ?? path;
  return (
    <HStack align="center" as="h1" gap={1} wrap="wrap">
      {folders.map((folder, index) => (
        <Text color="secondary" key={index} type="supporting">
          {folder} ›
        </Text>
      ))}
      <Icon icon="uraeda:file-text" size="sm" />
      <Text type="supporting" weight="semibold">
        {name}
      </Text>
      {isDirty && (
        <Text color="warning" type="supporting">
          <span aria-label="Not saved" role="img">
            ●
          </span>
        </Text>
      )}
    </HStack>
  );
}
