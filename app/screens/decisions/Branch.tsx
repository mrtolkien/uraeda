// A decision as a feature's branch has it, the page a decision's link opens from that feature's
// files, `/f/<folder>/decisions/<name>`: what the human reviews when a feature changes a rule. Its
// document is the branch's, each part the branch added or changed marked under it, and the parts
// it removed listed after. A branch without the decision, or a folder that is no feature's, has
// the default branch's: the address then opens the decision in force, in the same visit. A link's
// `#heading` scrolls to its heading, as in every document of the app.
import { effect, untracked, View } from "nsh";
import { navigate, record, redirect, route } from "../../store";
import type { Block, BranchDecision, PartChange } from "../../store/protocol";
import { Banner, Text } from "../../ui/controls";
import { definePane } from "../../ui/layout";
import { Card } from "../../ui/lists";
import { featureName } from "./Branches";
import { changeCounts, changeWords } from "./ledger";
import { follow } from "./links";
import { Column, Reading, Scroll, Title, ToDecision } from "./Reader";

/** The parts of a change of one kind. */
const partsOf = (decision: BranchDecision, kinds: ReadonlyArray<string>) =>
  decision.change.sections
    .flatMap((section) => section.parts)
    .filter((part) => kinds.includes(part.kind));

/** The part of the branch's version a block is in, when the branch added or changed it. */
function partAt(parts: ReadonlyArray<PartChange>, block: Block) {
  // A list or a table spans its items and rows, which carry their own marks.
  if (block.kind === "list" || block.kind === "table") {
    return undefined;
  }
  return parts.find(
    (part) =>
      part.after !== null && part.after.start <= block.endLine && part.after.end >= block.startLine,
  );
}

/** Its words, as one line. */
const words = (part: PartChange) => [...part.runs, ...part.check].map((run) => run.text).join(" ");

/** The mark under a block the branch added or changed: what a review reads first. */
function Changed(props: { kind: string }) {
  return (
    <Text size="under" tone="caution">
      {props.kind === "added" ? "Added on this branch" : "Changed on this branch"}
    </Text>
  );
}

function BranchReader(props: { folder: string; name: string; repo: string }) {
  const read = record("BranchDecision", { id: `${props.folder}/${props.name}`, repo: props.repo });
  const feature = () =>
    record("Workspace", { repo: props.repo })()?.features.find(
      (one) => one.folder === props.folder,
    );
  // No such decision on the branch: the decision in force, at the same heading, in this visit.
  effect(() => {
    if (read() === null) {
      untracked(() => redirect({ hash: route().hash, name: props.name, page: "decision" }));
    }
  });
  return (
    <If
      when={read()}
      else={
        <Column>
          <Reading error={read.error()?.message} />
        </Column>
      }
    >
      {(decision) => {
        const removed = () => partsOf(decision(), ["removed"]);
        return (
          <Scroll
            document={decision().document}
            footer={
              <If when={removed().length > 0}>
                <Banner title="Removed on this branch" tone="caution">
                  <View style={{ gap: 6 }}>
                    <Each of={removed()}>{(part) => <Text>{`– ${words(part())}`}</Text>}</Each>
                  </View>
                </Banner>
              </If>
            }
            header={
              <View style={{ gap: 8 }}>
                <Title icon="git-branch" title={decision().change.title} />
                <Card
                  facts={changeCounts(decision().change).map((label) => ({
                    icon: "git-compare",
                    label,
                  }))}
                  icon="git-branch"
                  onPress={() => navigate({ folder: props.folder, page: "feature" })}
                  state={{ label: changeWords(decision().change), tone: "caution" }}
                  title={`As the branch of ${feature() === undefined ? props.folder : featureName(feature()!)} has it`}
                  who="Not in force: the default branch's version is, until this branch merges."
                />
                <ToDecision label="Read the decision in force" name={props.name} />
              </View>
            }
            mark={(block) => {
              const part = partAt(partsOf(decision(), ["added", "changed"]), block);
              return part === undefined ? undefined : <Changed kind={part.kind} />;
            }}
            onLink={(link) => follow(link, props.folder)}
          />
        );
      }}
    </If>
  );
}

export const branchDecisionPane = definePane<{ folder: string; name: string; repo: string }>({
  icon: "git-branch",
  kind: "branch-decision",
  stack: "main",
  title: ({ folder, name, repo }) =>
    `${record("BranchDecision", { id: `${folder}/${name}`, repo })()?.change.title ?? name} on its branch`,
  view: (props) => (
    <BranchReader folder={props.args.folder} name={props.args.name} repo={props.args.repo} />
  ),
});
