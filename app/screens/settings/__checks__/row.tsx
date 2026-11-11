// What `settings.test.tsx` opens: a category's rows in a pane, as the settings draw them, one a
// switch whose server refuses every change after half a second, with the way out.
import { mount, signal, Text, View } from "nsh";
import { FieldRow, FieldRows } from "../../../ui/lists/FieldRow";
import { sent, Switch } from "../../../ui/controls";
import { KeysHost } from "../../../ui/keys/KeysHost";
import { KeyScope } from "../../../ui/keys/registry";
import { PaneContext } from "../../../ui/layout/panes";

const REFUSED = "config.toml cannot be written: its folder is read-only. Make it writable.";

function Rows() {
  const stored = signal(false);
  const vim = sent(
    stored,
    () => new Promise((_, refuse) => setTimeout(() => refuse(new Error(REFUSED)), 500)),
  );
  const rows = () => [{ id: "other" }, { act: () => vim.set(!vim.value()), id: "vim" }];
  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FieldRows rows={rows}>
        <FieldRow help="A row before it." icon="keyboard" id="other" label="Single-key shortcuts" />
        <FieldRow
          control={
            <Switch
              label={vim.value() ? "on" : "off"}
              onChange={vim.set}
              pending={vim.pending()}
              value={vim.value()}
            />
          }
          from="Set in config.toml"
          help="Vim's keys in every text field."
          icon="square-terminal"
          id="vim"
          label="Vim mode"
          refusal={vim.refusal()}
        />
      </FieldRows>
      <Text>{`Vim: ${vim.value() ? "on" : "off"}`}</Text>
    </View>
  );
}

const here = { focused: () => true, key: "settings-check", width: () => "wide" as const };

mount(() => (
  <KeysHost>
    <KeyScope name="Checks">
      <PaneContext.Provider value={here}>
        <Rows />
      </PaneContext.Provider>
    </KeyScope>
  </KeysHost>
));
