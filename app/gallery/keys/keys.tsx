// The keys: a key written out in each of its forms, the three views the registry opens (the leader
// menu after Space, the key map after `?`, and a picker), each opened by its button or its key,
// and what the status line says of the keys that work here.
import { signal, View } from "nsh";
import { Line, Page, Part } from "../parts";
import { Button, Kbd, Text } from "../../ui/controls";
import { keyHints, KeyPicker, pressKeys } from "../../ui/keys";

const FILES = [
  {
    aside: "spec",
    id: "spec",
    summary: "Tasks that come back on their own.",
    title: "Recurring tasks",
  },
  {
    aside: "plan",
    id: "plan",
    summary: "Twelve tasks, in three waves.",
    title: "Recurring tasks · plan",
  },
  { aside: "decision", id: "keyboard", summary: "Every action has a key.", title: "Keyboard" },
  { aside: "decision", id: "stack", summary: "Rust holds the logic.", title: "Stack" },
];

/** The picker open: the gallery's pictures open it with the page, `open: "picker"`. */
export const picking = signal(false);

/** Opens one of the keys' views, as the human would: by its key, or the picker's button. */
export function openKeys(view: string) {
  if (view === "leader") pressKeys("space");
  if (view === "map") pressKeys("?");
  if (view === "picker") picking.set(true);
}

export function keys(narrow: boolean) {
  const picked = signal("nothing yet");
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="A key, written out">
        <Line name="one" narrow={narrow}>
          <Kbd keys="j" />
          <Kbd keys="?" />
          <Kbd keys="Enter" />
          <Kbd keys="Escape" />
        </Line>
        <Line name="chord" narrow={narrow}>
          <Kbd keys="mod+k" />
          <Kbd keys="shift+ArrowDown" />
          <Kbd keys="mod+Enter" />
        </Line>
        <Line name="sequence" narrow={narrow}>
          <Kbd keys="g h" />
          <Kbd keys="space n n" />
        </Line>
        <Line name="beside" narrow={narrow}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Kbd keys="m" />
            <Text>move</Text>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Kbd keys="d" />
            <Text>delete</Text>
          </View>
        </Line>
      </Part>
      <Part narrow={narrow} title="What the registry opens">
        <Line name="leader" narrow={narrow}>
          <Button label="Leader menu" onPress={() => openKeys("leader")} />
        </Line>
        <Line name="key map" narrow={narrow}>
          <Button label="Keyboard shortcuts" onPress={() => openKeys("map")} />
        </Line>
        <Line name="picker" narrow={narrow}>
          <Button icon="search" label="Find a file" onPress={() => openKeys("picker")} />
        </Line>
        <Text size="under" tone="faint">
          Picked: {picked()}
        </Text>
      </Part>
      <Part narrow={narrow} title="The status line's hints, here">
        <Each of={keyHints()}>
          {(hint) => (
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Kbd keys={hint().keys} />
              <Text>{hint().label}</Text>
            </View>
          )}
        </Each>
      </Part>
      <KeyPicker
        items={FILES}
        onClose={() => picking.set(false)}
        onPick={(file) => picked.set(file.title)}
        open={picking()}
        preview={(file) => <Text>{file.summary}</Text>}
        title="Find a file"
      />
    </Page>
  );
}
