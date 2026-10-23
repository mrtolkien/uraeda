// A decision's changes on the features' branches, in the decisions page's reader: each feature in
// flight whose branch changes the decision's file shows its change as a diff, as the spec page's
// card draws it, naming the feature. Read from each feature's branch changes, which the shell's
// cards already request, then the branch's decision only for the features that change it (R26).
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Suspense } from "react";
import { useBranchChanges, useBranchDecision, useWorkspace } from "../data.ts";
import { branchDecisionPath } from "../routeTable.ts";
import { useRepoPath } from "../routes.tsx";
import { DecisionCard } from "../spec/DecisionCard.tsx";

/** A feature in flight, as the reader names it. */
type Proposer = { folder: string; title: string };

/** Whether the branch of the feature in `folder` changes the decision `name`'s file. */
export function useBranchChange(folder: string, name: string): boolean {
  const changes = useBranchChanges(folder)?.changes;
  return changes?.files.some((file) => file.path === `specs/decisions/${name}.md`) ?? false;
}

/** The change of a feature's branch to the decision `name`: its card, under who proposes it. */
function ChangeCard({ feature, name }: { feature: Proposer; name: string }) {
  const here = useRepoPath();
  const decision = useBranchDecision(feature.folder, name);
  // A branch that removes the file has no decision to read: the default branch's shows alone.
  if (!decision || decision.missing) {
    return null;
  }
  const { change } = decision;
  return (
    <section aria-label={`Proposed by ${feature.title}`}>
      <DecisionCard
        change={change}
        comments={[]}
        crumbs={[]}
        href={here(branchDecisionPath(feature.folder, name))}
        id={`branch-${feature.folder}-${name}`}
        kind={change.kind}
        name={name}
        note={<Text color="secondary">Proposed by {feature.title}, on its branch</Text>}
        parts={undefined}
        title={change.title}
      />
    </section>
  );
}

/** A feature's change to the decision `name`, when its branch has one. */
function FeatureChange({ feature, name }: { feature: Proposer; name: string }) {
  return useBranchChange(feature.folder, name) ? (
    <ChangeCard feature={feature} name={name} />
  ) : null;
}

/** The changes the features in flight make to the decision `name`, each a diff naming its feature. */
export function BranchChanges({ name }: { name: string }) {
  const features = (useWorkspace()?.features ?? []).filter((feature) => feature.branch);
  if (features.length === 0) {
    return null;
  }
  return (
    <VStack gap={4}>
      {features.map((feature) => (
        // Each feature's read on its own: one slow branch holds back no other, nor the reader.
        <Suspense fallback={null} key={feature.folder}>
          <FeatureChange
            feature={{ folder: feature.folder, title: feature.title || feature.slug }}
            name={name}
          />
        </Suspense>
      ))}
    </VStack>
  );
}
