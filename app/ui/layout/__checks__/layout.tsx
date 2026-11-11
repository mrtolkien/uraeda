// What `layout.test.ts` opens: the frame with a place of its own, two panes in main and three in
// side, each pane with a `j` and a `k` of its own that stop at its edges, under the app's
// `KeysHost`. A pane says when it has the focus, and the list says where it is scrolled.
import { mount, signal, View } from "nsh";
import { Text } from "../../controls";
import { KeysHost } from "../../keys/KeysHost";
import { registerKey } from "../../keys/registry";
import { definePane, PaneScroll, usePane } from "../panes";
import { Stacks } from "../Stacks";

/** A pane's own rows: `j` `k` move its pick, and give the key back at either end. */
function Picks(props: { rows: number; title: string }) {
  const pane = usePane();
  const picked = pane.remember<number>("picked", 0);
  const move = (by: number) => {
    const next = picked() + by;
    if (next < 0 || next >= props.rows) {
      return false;
    }
    picked.set(next);
    return undefined;
  };
  registerKey([
    { keys: "j", label: "Next row", run: () => move(1) },
    { keys: "k", label: "Previous row", run: () => move(-1) },
  ]);
  return (
    <View>
      <If when={pane.focused()}>
        <Text>Focus: {props.title}</Text>
      </If>
      <Text>
        {props.title} picked {String(picked())}
      </Text>
    </View>
  );
}

const list = definePane({
  flush: true,
  icon: "list",
  kind: "check-list",
  stack: "main",
  title: "List",
  view: () => {
    const at = signal(0);
    const rows = Array.from({ length: 100 }, (_, index) => `Row ${index}`);
    return (
      <View style={{ flex: 1 }}>
        <Picks rows={rows.length} title="List" />
        <Text>List at {String(Math.round(at()))}</Text>
        <PaneScroll
          onScroll={(event) => at.set(event.offset.y)}
          style={{ flex: 1 }}
          testID="pane-scroll-list"
        >
          <Each of={rows}>{(row) => <Text style={{ height: 28 }}>{row()}</Text>}</Each>
        </PaneScroll>
      </View>
    );
  },
});

const notes = definePane({
  closes: true,
  icon: "file-text",
  kind: "check-notes",
  stack: "main",
  title: "Notes",
  view: () => <Picks rows={3} title="Notes" />,
});

const side = (kind: string, title: string) =>
  definePane({
    closes: true,
    icon: "activity",
    kind,
    mark: () => (title === "Changes" ? { count: 4 } : {}),
    stack: "side",
    title,
    view: () => <Picks rows={5} title={title} />,
  });

const activity = side("check-activity", "Activity");
const changes = side("check-changes", "Changes");
const plan = side("check-plan", "Plan");

mount(() => (
  <KeysHost>
    <Stacks
      place={{ main: [list({}), notes({})], side: [activity({}), changes({}), plan({})] }}
      status={{ place: "checks" }}
    />
  </KeysHost>
));
