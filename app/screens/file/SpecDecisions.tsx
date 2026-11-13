// A spec's decisions: each decision its branch adds, changes, or removes, a card of what changes,
// the ones its `## Decisions` lists first. Approving the spec approves them: a decision changed on
// the branch and not listed is said, as the review must catch it. `Enter` or a press opens the
// decision as the branch has it, its changed parts marked in place.
import { View } from "nsh";
import { navigate } from "../../store";
import type { DecisionChange, FileView } from "../../store/protocol";
import type { Tone } from "../../ui/tokens";
import { PaneScroll, usePane } from "../../ui/layout";
import { Card, createCursor, Empty, listKeys } from "../../ui/lists";
import { changeCounts } from "../decisions/ledger";
import { type FileArgs, WithFile } from "./read";

const KINDS: Readonly<Record<string, { label: string; tone: Tone }>> = {
  changed: { label: "Changed", tone: "caution" },
  new: { label: "New", tone: "done" },
  removed: { label: "Removed", tone: "danger" },
};

/** One decision's card: what the branch does to it, and whether the spec says so. */
function DecisionCard(props: { change: DecisionChange; selected: boolean; open: () => void }) {
  const facts = () => [
    ...changeCounts(props.change).map((label) => ({ icon: "git-compare" as const, label })),
    ...(props.change.compared
      ? []
      : [
          {
            icon: "triangle-alert" as const,
            label: "One of its versions could not be read: open it to see the branch's.",
            tone: "caution" as const,
          },
        ]),
  ];
  return (
    <Card
      facts={facts()}
      icon="scale"
      onPress={props.open}
      selected={props.selected}
      state={KINDS[props.change.kind] ?? { label: props.change.kind, tone: "quiet" }}
      testID={`spec-decision-${props.change.name}`}
      title={props.change.title}
      who={
        props.change.listed
          ? "Listed in the spec's decisions"
          : "Not listed in the spec's decisions: its branch changes it all the same"
      }
    />
  );
}

function Cards(props: { args: FileArgs; file: () => FileView }) {
  const kept = usePane().remember<string | null>("at", null);
  const changes = () => props.file().decisionChanges;
  const rows = () => changes().map((change) => ({ id: change.name }));
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const open = (name: string) =>
    navigate({ folder: props.args.folder, name, page: "branch-decision" });
  listKeys(cursor, { onOpen: open, openLabel: "open the decision" });
  return (
    <If
      when={changes().length > 0}
      else={
        <Empty
          icon="scale"
          title="No decision changed"
          words="Its branch changes no file of specs/decisions/, and its Decisions part lists none."
        />
      }
    >
      <View style={{ gap: 8 }}>
        <Each key={(change: DecisionChange) => change.name} of={changes()}>
          {(change) => (
            <DecisionCard
              change={change()}
              open={() => {
                cursor.set(change().name);
                open(change().name);
              }}
              selected={cursor.holds(change().name)}
            />
          )}
        </Each>
      </View>
    </If>
  );
}

/** The pane "Decisions" of a spec. */
export function SpecDecisions(props: { args: FileArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFile args={props.args} beside>
        {(file) => <Cards args={props.args} file={file} />}
      </WithFile>
    </PaneScroll>
  );
}
