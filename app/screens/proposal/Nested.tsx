// A proposal's nested lines, the items under its line in the priorities, as an outline: one row
// each, indented by its depth, with a cursor. `>` and `<` indent and outdent the row, `J` and `K`
// move it among its siblings, `o` adds a line below it, Enter edits it, `d` removes it, each over
// `proposals.outline` and on the undo stack. "Add a nested line" adds one at the end. The human's
// own priorities nest lines under most proposals: this is where they are edited without the file.
import { computed, signal, View } from "nsh";
import { call, type Live } from "../../store";
import type { NestedItem, Priorities, ProposalItem } from "../../store/protocol";
import { Button, Refusal, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { createCursor, Line, List } from "../../ui/lists";
import { plain } from "../priorities/Section";
import { remember } from "../shell/undo";
import { NameDialog } from "../NameDialog";

/** The dialog open: a line edited, or a new one, below a row or at the end. */
type Asking = {
  kind: "edit" | "insert-below" | "append-child";
  at: number | null;
  initial: string;
};

const WORDS: Record<string, string> = {
  "append-child": "Added a nested line to",
  down: "Moved a nested line of",
  edit: "Edited a nested line of",
  indent: "Indented a nested line of",
  "insert-below": "Added a nested line to",
  outdent: "Outdented a nested line of",
  remove: "Removed a nested line of",
  up: "Moved a nested line of",
};

export function Nested(props: {
  priorities: Live<Priorities>;
  proposal: ProposalItem;
  repo: string;
}) {
  const items = () => props.proposal.children;
  const rows = computed(() => items().map((item) => ({ id: item.key })));
  const cursor = createCursor(rows);
  const refusal = signal<string | null>(null);
  const asking = signal<Asking | null>(null);
  const indexOf = (key: string | undefined) => items().findIndex((item) => item.key === key);
  const at = () => {
    const index = indexOf(cursor.at());
    return index === -1 ? undefined : index;
  };

  const outline = async (kind: string, index: number | null, text?: string) => {
    refusal.set(null);
    const written = await call("proposals.outline", {
      at: index,
      hash: props.priorities()?.hash ?? "",
      kind,
      proposal: props.proposal.id,
      repo: props.repo,
      ...(text === undefined ? {} : { text }),
    });
    remember(written.change, `${WORDS[kind]} “${plain(props.proposal)}”.`, {
      repo: props.repo,
      subject: plain(props.proposal),
    });
  };
  const run = (kind: string) => () => {
    const index = at();
    if (index === undefined) return false;
    outline(kind, index).catch((error: Error) => refusal.set(error.message));
    return undefined;
  };
  const ask = (kind: Asking["kind"]) => () => {
    const index = at();
    if (kind !== "append-child" && index === undefined) return false;
    const initial = kind === "edit" ? (items()[index!]?.text ?? "") : "";
    asking.set({ at: kind === "append-child" ? null : index!, initial, kind });
    return undefined;
  };

  registerKey([
    {
      hint: "> <",
      hintLabel: "indent",
      keys: ">",
      label: "Indent the nested line",
      run: run("indent"),
    },
    { keys: "<", label: "Outdent the nested line", run: run("outdent") },
    {
      hint: "J K",
      hintLabel: "move line",
      keys: "J",
      label: "Move the nested line down",
      run: run("down"),
    },
    { keys: "K", label: "Move the nested line up", run: run("up") },
    {
      hint: "o",
      hintLabel: "add below",
      keys: "o",
      label: "Add a nested line below",
      run: ask("insert-below"),
    },
    { keys: "d", label: "Remove the nested line", run: run("remove") },
  ]);

  return (
    <View style={{ gap: 6 }}>
      <Text size="under" tone="quiet">
        Its nested lines
      </Text>
      <If when={items().length > 0}>
        <List
          cursor={cursor}
          onOpen={() => void ask("edit")()}
          openLabel="edit"
          row={(id) => <Row item={items()[indexOf(id())]} />}
          testID="proposal-nested"
        />
      </If>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button icon="plus" label="Add a nested line" onPress={() => void ask("append-child")()} />
        <If when={items().length > 0}>
          <Text size="under" tone="faint">
            Enter edits a line, o adds one below, &gt; and &lt; indent it, J and K move it, d
            removes it.
          </Text>
        </If>
      </View>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      <If when={asking()}>
        {(open) => (
          <NameDialog
            blank="A nested line needs words: d removes one."
            icon={open().kind === "edit" ? "pencil" : "plus"}
            initial={open().initial}
            label="The line"
            onClose={() => asking.set(null)}
            onSave={(text) => outline(open().kind, open().at, text)}
            title={open().kind === "edit" ? "Edit the nested line" : "Add a nested line"}
            words="One line of Markdown, under the proposal's line in the priorities."
          />
        )}
      </If>
    </View>
  );
}

function Row(props: { item: NestedItem | undefined }) {
  return (
    <View style={{ paddingLeft: (props.item?.depth ?? 0) * 18 }}>
      <Line icon="minus" label={props.item?.text ?? ""} />
    </View>
  );
}
