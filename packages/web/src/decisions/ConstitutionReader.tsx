// The whole constitution in the decisions page's reader: one file, one page, read top to bottom,
// as the core's tree of `CONSTITUTION.md` draws it.
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Blocks } from "../Blocks.tsx";
import { type LedgerConstitution, versionLine } from "./ConstitutionRegion.tsx";

/** The constitution: its title and version, then every block of its file past its title. */
export function ConstitutionReader({ constitution }: { constitution: LedgerConstitution }) {
  const { document } = constitution;
  // The title is the reader's heading.
  const ids = document.blocks
    .filter((block) => block.parent === undefined)
    .filter((block) => !(block.kind === "heading" && block.level === 1))
    .map((block) => block.id);
  const version = versionLine(constitution);
  return (
    <article aria-label="Constitution">
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>{constitution.title}</Heading>
          {version && (
            <Text color="secondary" type="supporting">
              {version}
            </Text>
          )}
        </VStack>
        <Blocks document={document} ids={ids} />
      </VStack>
    </article>
  );
}
