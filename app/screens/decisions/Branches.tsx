// The features whose branches change a decision: what the human reviews before a rule changes.
// Each feature in flight whose branch changes the decision's file shows a card, naming the feature,
// what its branch does to the decision, and the way to read the branch's version. Read from each
// feature's branch changes, then the branch's decision, only for the features that change it or
// whose list of changes is cut short of it: the core lists the first 50 files.
import { View } from "nsh";
import { navigate, record } from "../../store";
import type { WorkspaceFeature } from "../../store/protocol";
import { Card } from "../../ui/lists";
import { changeCounts, changeWords, isChanged } from "./ledger";

/** The features of a repository with a branch of their own. */
export function branched(repo: string): ReadonlyArray<WorkspaceFeature> {
  return (record("Workspace", { repo })()?.features ?? []).filter(
    (feature) => feature.branch !== null && feature.source !== "default-branch",
  );
}

/** What a feature calls itself, aloud. */
export const featureName = (feature: WorkspaceFeature) =>
  feature.label ?? (feature.title || feature.slug);

/**
 * Whether the branch of `folder` changes the decision `name`: `"unknown"` when its list of changes
 * is cut short of it, so the branch's decision must be read to tell.
 */
export function changesIt(repo: string, folder: string, name: string): boolean | "unknown" {
  const changes = record("BranchChanges", { id: folder, repo })()?.changes;
  if (changes === undefined || changes === null) {
    return false;
  }
  if (changes.files.some((file) => file.path === `specs/decisions/${name}.md`)) {
    return true;
  }
  return changes.count > changes.files.length ? "unknown" : false;
}

/** One feature's change to the decision, as a card: nothing when its branch leaves it alone. */
function Proposal(props: { feature: WorkspaceFeature; name: string; repo: string }) {
  const read = () =>
    record("BranchDecision", { id: `${props.feature.folder}/${props.name}`, repo: props.repo })();
  const change = () => {
    const decision = read();
    return decision === undefined || decision === null || !isChanged(decision.change)
      ? undefined
      : decision.change;
  };
  return (
    <If when={change()}>
      {(shown) => (
        <Card
          actions={[
            {
              icon: "git-compare",
              label: "Read the branch's version",
              run: () =>
                navigate({
                  folder: props.feature.folder,
                  name: props.name,
                  page: "branch-decision",
                }),
            },
            {
              icon: "git-branch",
              label: "Open the feature",
              run: () => navigate({ folder: props.feature.folder, page: "feature" }),
            },
          ]}
          facts={changeCounts(shown()).map((label) => ({ icon: "git-compare", label }))}
          icon="git-branch"
          state={{ label: changeWords(shown()), tone: "caution" }}
          title={`Proposed by ${featureName(props.feature)}`}
          who="On its branch: in force once the feature merges"
        />
      )}
    </If>
  );
}

/** The changes the features in flight make to the decision `name`, one card each. */
export function Proposals(props: { name: string; repo: string }) {
  const changing = () =>
    branched(props.repo).filter(
      (feature) => changesIt(props.repo, feature.folder, props.name) !== false,
    );
  return (
    <If when={changing().length > 0}>
      <View style={{ gap: 8 }}>
        <Each key={(feature: WorkspaceFeature) => feature.folder} of={changing()}>
          {(feature) => <Proposal feature={feature()} name={props.name} repo={props.repo} />}
        </Each>
      </View>
    </If>
  );
}
