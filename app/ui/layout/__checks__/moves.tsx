// What `moves.test.tsx` opens: the frame with a place of its own, a list that scrolls and notes
// typed in a field in main, three panes in side, under the app's `KeysHost`, which hears the
// leader. It prints the layout the frame draws in one line, as the tests' tables write it. The
// Activity's rows open a detail beside them with `shift+Enter`. Its device's storage is the test's.
import { mount, signal, View } from "nsh";
import { seen } from "./seen";
import { device } from "../../../store/device";
import { Text } from "../../controls";
import { KeysHost } from "../../keys/KeysHost";
import { createCursor, List } from "../../lists";
import { TextField } from "../../text";
import { definePane, PaneScroll, usePane } from "../panes";
import { frameLayout, Stacks } from "../Stacks";

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
  view: () => {
    const text = usePane().remember("text", "");
    return <TextField label="Notes" onChange={text.set} testID="notes-field" value={text()} />;
  },
});

const detail = definePane<{ row: string }>({
  icon: "file-text",
  kind: "check-detail",
  stack: "main",
  title: (args) => `Detail ${args.row}`,
  view: (props) => <Text>Detail of {props.args.row}</Text>,
});

/** The Activity's rows, each naming a detail. */
const activityRows = () => ["a", "b", "c"].map((id) => ({ id }));

const activity = definePane({
  closes: true,
  icon: "activity",
  kind: "check-activity",
  stack: "side",
  title: "Activity",
  view: () => {
    const cursor = createCursor(activityRows);
    return (
      <List
        beside={(id) => detail({ row: id })}
        cursor={cursor}
        row={(id) => <Text>Row {id()}</Text>}
      />
    );
  },
});

const side = (kind: string, title: string) =>
  definePane({
    closes: true,
    icon: "activity",
    kind,
    stack: "side",
    title,
    view: () => <Text>{title}</Text>,
  });

const changes = side("check-changes", "Changes");
const plan = side("check-plan", "Plan");

// The device's values are read before the frame is drawn, as the app reads them.
void device.load().then(() =>
  mount(() => (
    <KeysHost>
      <View style={{ flex: 1 }}>
        <Text testID="layout-line">{frameLayout() === undefined ? "" : seen(frameLayout()!)}</Text>
        <Stacks
          place={{ main: [list({}), notes({})], side: [activity({}), changes({}), plan({})] }}
          status={{ place: "checks" }}
        />
      </View>
    </KeysHost>
  )),
);
