// The whole constitution in the decisions page's reader: one file, read top to bottom, as the
// core's tree of `CONSTITUTION.md` draws it, scrolled to the principle the address names.
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState } from "react";
import { Blocks } from "../Blocks.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { currentEntry } from "../routeHistory.ts";
import { type LedgerConstitution, versionLine } from "./ConstitutionRegion.tsx";

/**
 * The constitution: its title and version, then every block of its file past its title. With
 * `slug`, the reader scrolls to that principle's heading once drawn, unless its history entry has
 * a place to return to, and again as it changes.
 */
export function ConstitutionReader({
  constitution,
  slug,
}: {
  constitution: LedgerConstitution;
  slug: string | undefined;
}) {
  const { document } = constitution;
  const anchor = constitution.principles.find((principle) => principle.slug === slug)?.blocks[0];
  const id = anchor === undefined ? undefined : document.blocks[anchor]?.anchor;
  const narrow = isNarrow(useWidthClass());
  // Drawn on an entry with a place of its own, as after Back or a reload, the reader keeps it at
  // first: the reader's pane's on wide screens, the window's on the phone, where it is the page.
  const [restores] = useState(() => {
    const entry = currentEntry();
    return typeof (narrow ? entry.scroll : entry.pane) === "number";
  });
  const isFirst = useRef(true);
  // After the reader's own layout effects, which show another entry from its top.
  useEffect(() => {
    if (id && !(isFirst.current && restores)) {
      window.document.getElementById(id)?.scrollIntoView?.({ block: "start" });
    }
    isFirst.current = false;
  }, [id, restores]);
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
