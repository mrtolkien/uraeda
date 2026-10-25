// A feature's links, in a pane of the Home's column: its branch, its worktree, and its pull
// request. Mockups sit in the timeline, and stories in the sentences that name them.
import { Code } from "@astryxdesign/core/Code";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { Pane } from "../layout/Pane.tsx";
import { FactRow } from "./ProducedPane.tsx";

/** What the links read of the feature. */
export type LinksFeature = {
  branch?: string | null | undefined;
  pullRequest?: { number: number; url: string } | null | undefined;
  worktree?: string | null | undefined;
};

/** The feature's branch, worktree, and pull request, those it has; none, no pane. */
export function LinksPane({ feature }: { feature: LinksFeature }) {
  const { branch, pullRequest, worktree } = feature;
  if (!branch && !worktree && !pullRequest) {
    return null;
  }
  return (
    <Pane title="Links">
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
            >
              #{pullRequest.number} ↗
            </Link>
          </FactRow>
        )}
      </VStack>
    </Pane>
  );
}
