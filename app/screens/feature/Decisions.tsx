// The decisions the feature touches, by their titles in the ledger: once merged, those its history
// found new, changed, or removed; before, the files of `specs/decisions/` its branch changes. Each
// opens on the Decisions page.
import { navigate, record } from "../../store";
import type { DecisionChange, Feature } from "../../store/protocol";
import { iconNamed, Spinner } from "../../ui/controls";
import { PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { type FeatureArgs, WithFeature } from "./read";

/** Where the ledger's decisions are, from the top level. */
const FOLDER = "specs/decisions/";

/** A decision it touches: its name, and how, "new", "changed", "removed". */
type Touched = { id: string; how: string };

function Rows(props: { args: FeatureArgs; feature: () => Feature }) {
  const item = { id: props.args.folder, repo: props.args.repo };
  const done = () => props.feature().step.name === "done";
  const history = record("History", item);
  const changes = record("BranchChanges", item);
  const ledger = record("Ledger", { repo: props.args.repo });
  const titles = () => new Map((ledger()?.decisions ?? []).map((one) => [one.name, one]));
  const touched = (): Array<Touched> | undefined => {
    if (done()) {
      return history()?.decisions.map((one: DecisionChange) => ({ how: one.kind, id: one.name }));
    }
    const read = changes();
    if (read === undefined) return undefined;
    return (read.changes?.files ?? [])
      .filter((file) => file.path.startsWith(FOLDER) && file.path.endsWith(".md"))
      .map((file) => {
        const id = file.path.slice(FOLDER.length, -3);
        return { how: titles().has(id) ? "changed" : "new", id };
      });
  };
  const kept = usePane().remember<string | null>("at", null);
  const cursor = createCursor(() => touched() ?? [], {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const how = (id: string) => touched()?.find((one) => one.id === id)?.how;
  return (
    <If when={touched() !== undefined} else={<Spinner label="Reading what its branch changes" />}>
      <List
        cursor={cursor}
        empty={
          <Empty
            icon="scale"
            title="No decision touched"
            words={
              changes()?.failed === true && !done()
                ? "Its branch's changes could not be read: git failed on the server."
                : done()
                  ? "It changed no file of the ledger."
                  : "Its branch changes no decision of the ledger yet: a spec's decisions land as it is approved."
            }
          />
        }
        onOpen={(id) => {
          if (how(id) !== "removed") navigate({ name: id, page: "decision" });
        }}
        openLabel="open the decision"
        row={(id) => (
          <Line
            icon={iconNamed(titles().get(id())?.icon, "scale")}
            label={titles().get(id())?.title ?? id()}
            meta={how(id())}
            metaTone={how(id()) === "removed" ? "danger" : how(id()) === "new" ? "done" : undefined}
            quiet={how(id()) === "removed"}
          />
        )}
      />
    </If>
  );
}

/** The pane "Decisions". */
export function Decisions(props: { args: FeatureArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFeature args={props.args}>
        {(feature) => <Rows args={props.args} feature={feature} />}
      </WithFeature>
    </PaneScroll>
  );
}
