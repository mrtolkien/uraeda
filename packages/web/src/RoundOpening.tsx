import { Heading } from "@astryxdesign/core/Heading";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ContextPart, Document, RoundItems } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { plain } from "./Spans.tsx";

const styles = stylex.create({
  title: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/** The context's blocks: each part's heading, when it has one, then its blocks. */
function contextBlocks(parts: ReadonlyArray<ContextPart>): Array<number> {
  return parts.flatMap((part) =>
    part.heading === undefined ? part.blocks : [part.heading, ...part.blocks],
  );
}

/**
 * A round's opening: the feature's crumbs, unless it is the triage, the round's title, its block,
 * then its context.
 */
export function RoundOpening({
  crumbs,
  document,
  round,
}: {
  /** The feature's folder and the round's name, for its crumbs; none for the triage. */
  crumbs?: { folder: string; name: string };
  document: Document;
  round: RoundItems;
}) {
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  return (
    <>
      {crumbs && <Crumbs current={crumbs.name} folder={crumbs.folder} />}
      {title && (
        <Heading level={1} xstyle={styles.title}>
          {plain(title.spans)}
        </Heading>
      )}
      {round.block !== undefined && <Blocks document={document} ids={[round.block]} />}
      <Blocks document={document} ids={contextBlocks(round.context)} />
    </>
  );
}
