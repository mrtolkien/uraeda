// What `focus.test.tsx` opens: the frame with a form in main, two buttons, a switch, a button that
// goes once pressed, and a field, over a list with a cursor of its own, and a pane in side with a
// document's link and a button of its own, under the app's `KeysHost`. It says what was pressed,
// what the list's Enter opened, and what link was followed.
import { mount, signal, View } from "nsh";
import { markdownTree } from "uraeda/native";
import type { Document as Tree } from "../../../store/protocol";
import { Document } from "../../document";
import { Button, Switch, Text } from "../../controls";
import { KeysHost } from "../../keys/KeysHost";
import { createCursor, List } from "../../lists";
import { TextField } from "../../text";
import { definePane } from "../panes";
import { Stacks } from "../Stacks";

const said = signal<Array<string>>([]);
const note = (what: string) => said.update((list) => [...list, what]);

const form = definePane({
  icon: "settings",
  kind: "check-form",
  stack: "main",
  title: "Form",
  view: () => {
    const typed = signal("");
    const on = signal(false);
    const lasts = signal(true);
    const cursor = createCursor(() => [{ id: "a" }, { id: "b" }]);
    return (
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label="Save" onPress={() => note("save")} />
          <Button label="Reset" onPress={() => note("reset")} />
          <Switch label={on() ? "on" : "off"} onChange={on.set} value={on()} />
          <If when={lasts()}>
            <Button
              label="Once"
              onPress={() => {
                note("once");
                lasts.set(false);
              }}
            />
          </If>
        </View>
        <TextField label="Name" lines="one" onChange={typed.set} testID="name" value={typed()} />
        <List
          cursor={cursor}
          onOpen={(id) => note(`opened ${id}`)}
          row={(id) => <Text>Row {id()}</Text>}
        />
      </View>
    );
  },
});

/** A document whose link leads to a heading: Tab reaches it, and Enter follows it. */
const GUIDE = JSON.parse(markdownTree("See [the guide](#guide), then press Aside.")) as Tree;

const aside = definePane({
  icon: "activity",
  kind: "check-aside",
  stack: "side",
  title: "Aside",
  view: () => (
    <View style={{ gap: 8 }}>
      <Document document={GUIDE} onLink={(link) => note(`followed ${link.target}`)} />
      <Button label="Aside" onPress={() => note("aside")} />
    </View>
  ),
});

mount(() => (
  <KeysHost>
    <View style={{ flex: 1 }}>
      <Text testID="said">{`Said: ${said().join(", ") || "nothing"}`}</Text>
      <Stacks place={{ main: [form({})], side: [aside({})] }} status={{ place: "checks" }} />
    </View>
  </KeysHost>
));
