// A decision as a feature's branch has it, the page a decision link of the feature's files opens:
// its card, its change against the default branch marked in place, scrolled to the section the
// link names. Without it on a branch, the decisions page shows the default branch's.
import { useLayoutEffect } from "react";
import { Crumbs } from "../Crumbs.tsx";
import { useBranchDecision } from "../data.ts";
import { Page } from "../layout/Page.tsx";
import { redirect, useHash, useRepoPath, useRestoreScroll } from "../routes.tsx";
import { DecisionCard } from "../spec/DecisionCard.tsx";
import { decisionId } from "../spec/parts.ts";

/** The decision `name` of the feature in `folder`, as its branch has it. */
export function BranchDecisionPage({ folder, name }: { folder: string; name: string }) {
  const decision = useBranchDecision(folder, name);
  const here = useRepoPath();
  const hash = decodeURIComponent(useHash().slice(1));
  useRestoreScroll(true);
  const found = !!decision && !decision.missing;
  const missing = !!decision?.missing;
  // The link's anchor, a section's heading, once the card is drawn. A feature without a branch,
  // or whose branch has no such decision, has the default branch's: the decisions page opens, at
  // the same anchor.
  useLayoutEffect(() => {
    if (missing) {
      redirect(here(`/decisions/${encodeURIComponent(name)}`) + window.location.hash);
    } else if (found && hash) {
      document.getElementById(hash)?.scrollIntoView?.({ block: "start" });
    }
  }, [found, hash, here, missing, name]);
  if (!decision || decision.missing) {
    return null;
  }
  const { change, document: tree } = decision;
  // A section's heading takes the anchor its heading has in the decision's file.
  const sectionId = (title: string) =>
    tree.blocks.find((b) => b.kind === "heading" && b.level === 2 && b.text === title)?.anchor;
  return (
    <Page>
      <Crumbs current={change.title} folder={folder} />
      <DecisionCard
        change={change}
        comments={[]}
        crumbs={[]}
        full
        href={undefined}
        id={decisionId(name)}
        kind={change.kind}
        name={name}
        parts={undefined}
        sectionId={sectionId}
        title={change.title}
      />
    </Page>
  );
}
