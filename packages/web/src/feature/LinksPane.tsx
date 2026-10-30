// A feature's links, in a pane of the Home's column: its branch, its worktree, and its pull
// request. Mockups sit in the timeline, and stories in the sentences that name them.
import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Pane } from "../layout/Pane.tsx";
import { FactRow } from "./ProducedPane.tsx";

const styles = stylex.create({
  // As tall as a control: a finger's 44 px under a coarse pointer.
  link: { alignItems: "center", display: "inline-flex", minHeight: sizeVars["--size-element-sm"] },
});

/** What the links read of the feature. */
export type LinksFeature = {
  branch?: string | null | undefined;
  pullRequest?: { number: number; url: string } | null | undefined;
  worktree?: string | null | undefined;
};

/** Whether the feature has a link to show. */
export function hasLinks({ branch, pullRequest, worktree }: LinksFeature): boolean {
  return Boolean(branch || worktree || pullRequest);
}

/** The feature's branch, worktree, and pull request, those it has; none, no pane. */
export function LinksPane({ feature }: { feature: LinksFeature }) {
  if (!hasLinks(feature)) {
    return null;
  }
  return (
    <Pane title="Links">
      <LinkRows feature={feature} />
    </Pane>
  );
}

/** The links, without a pane, as the phone's sheet shows them. */
export function LinkRows({ feature }: { feature: LinksFeature }) {
  const { branch, pullRequest, worktree } = feature;
  return (
    <VStack gap={2}>
      {branch && (
        <FactRow label="branch">
          <Code>{branch}</Code>
        </FactRow>
      )}
      {worktree && (
        <FactRow label="worktree">
          <Code>{worktree}</Code>
        </FactRow>
      )}
      {pullRequest && (
        <FactRow label="pull request">
          {/* In a new tab, as "Next" opens it. */}
          <Link
            aria-label={`Pull request #${pullRequest.number}`}
            href={pullRequest.url}
            rel="noopener noreferrer"
            target="_blank"
            xstyle={styles.link}
          >
            #{pullRequest.number} ↗
          </Link>
        </FactRow>
      )}
    </VStack>
  );
}
