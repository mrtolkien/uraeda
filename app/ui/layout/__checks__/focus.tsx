// What `focus.test.tsx` opens: the frame with a form in main, two buttons, a switch, a button that
// goes once pressed, and a field, over a list with a cursor of its own, and a pane in side with a
// button of its own, under the app's `KeysHost`. It says what was pressed and what the list's
// Enter opened.
import { mount, signal, View } from "nsh";
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

const aside = definePane({
  icon: "activity",
  kind: "check-aside",
  stack: "side",
  title: "Aside",
  view: () => <Button label="Aside" onPress={() => note("aside")} />,
});

mount(() => (
  <KeysHost>
    <View style={{ flex: 1 }}>
      <Text testID="said">{`Said: ${said().join(", ") || "nothing"}`}</Text>
      <Stacks place={{ main: [form({})], side: [aside({})] }} status={{ place: "checks" }} />
    </View>
  </KeysHost>
));
