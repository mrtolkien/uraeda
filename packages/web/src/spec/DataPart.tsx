// TEMPORARY: task 12 of the specs redesign rewrites the data part, each entity a card and its
// "Change" column as coloured pills. Until then, the data model's blocks show in one card.
import type { Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps } from "./parts.ts";

/**
 * What the data part draws: the feature's folder, the width, and `data-model.md`'s tree, which the
 * page reads, and draws no part without.
 */
export type DataPartProps = Pick<PartProps, "folder" | "wide"> & { document: Document };

/** The data model, after its title. */
export function DataPart({ document }: DataPartProps) {
  const ids = document.blocks
    .filter((b) => b.parent == null && !(b.kind === "heading" && b.level === 1))
    .map((b) => b.id);
  return (
    <Panel crumbs={[GROUPS.data.title]} id="data-model" title="Data model">
      <Blocks document={document} ids={ids} />
    </Panel>
  );
}
