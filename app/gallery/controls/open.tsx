// The lists a select and a menu open, open: a select's on a popover, a sheet on a narrow window,
// and a menu's on a popover at every width, with a key, a dangerous row, and a disabled one.
import { View } from "nsh";
import { Page, Part } from "../parts";
import { Menu, Select, Text } from "../../ui/controls";

const nothing = () => {};

export function select(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Select">
        <Select
          label="Agent"
          onChange={nothing}
          open
          options={[
            { hint: "the default", icon: "openai", label: "Codex", value: "codex" },
            { icon: "claude", label: "Claude Code", value: "claude" },
            { disabled: true, icon: "pi", label: "Pi", value: "pi" },
          ]}
          value="claude"
          width={220}
        />
        <View style={{ height: 160 }} />
      </Part>
    </Page>
  );
}

export function menu(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Menu">
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <Text>A row with more</Text>
          <Menu
            entries={[
              { icon: "pencil", keys: "e", label: "Edit", run: nothing },
              { icon: "copy", label: "Copy its path", run: nothing },
              { disabled: true, icon: "git-branch", label: "Start work", run: nothing },
              {
                danger: true,
                icon: "trash-2",
                keys: "d",
                label: "Delete",
                ruled: true,
                run: nothing,
              },
            ]}
            label="More of the row"
            open
          />
        </View>
        <View style={{ height: 180 }} />
      </Part>
    </Page>
  );
}
