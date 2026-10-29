import { Heading } from "@astryxdesign/core/Heading";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Document, RoundItems } from "uraeda-binding";
import { Crumbs } from "./Crumbs.tsx";
import { RoundBlock, RoundContext } from "./RoundParts.tsx";
import { plain } from "./Spans.tsx";

const styles = stylex.create({
  title: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/**
 * A round's opening: the feature's crumbs, unless it is a default-branch round's, the round's
 * title, its block's pane, then its context's panes, and `check` after them.
 */
export function RoundOpening({
  check,
  crumbs,
  document,
  round,
}: {
  /** The "Check these" pane, after the context's last part. */
  check?: ReactNode;
  /** The feature's folder and the round's name, for its crumbs; none for a default-branch round. */
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
      <RoundBlock document={document} round={round} />
      <RoundContext check={check} document={document} round={round} />
    </>
  );
}
