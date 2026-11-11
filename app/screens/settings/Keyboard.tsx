// The Keyboard category: the single-key shortcuts and Vim mode, each a switch saved at once, the
// human's Vim commands, a field saved with Ctrl+Enter or its button, and the way to every key.
import { View } from "nsh";
import { FileProblem, savedField, settingsRecord } from "./fields";
import { wordsOf } from "./categories";
import { fromWords, isOverridden, onOff } from "./Row";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { call } from "../../store";
import { Button, sent, Switch } from "../../ui/controls";
import { pressKeys } from "../../ui/keys";
import { TextField } from "../../ui/text";

/** A text's lines, blank ones left out. */
const linesOf = (text: string) => text.split("\n").filter((line) => line.trim() !== "");

/** A row's words, by its name. */
const words = (label: string) => wordsOf("keyboard", label);

export function Keyboard() {
  const settings = settingsRecord();
  const keyboard = () => settings()?.keyboard;
  const single = sent(
    () => keyboard()?.singleKeyShortcuts.saved ?? keyboard()?.singleKeyShortcuts.inForce ?? true,
    (on) => call("settings.setSingleKeyShortcuts", { on }),
  );
  const vim = sent(
    () => keyboard()?.vimMode.saved ?? keyboard()?.vimMode.inForce ?? false,
    (on) => call("settings.setVimMode", { on }),
  );
  const saved = () =>
    (keyboard()?.vimCommands.saved ?? keyboard()?.vimCommands.inForce ?? []).join("\n");
  const commands = savedField("vim-commands", saved, (text) =>
    call("settings.setVimCommands", { lines: linesOf(text) }),
  );
  const writable = () => settings()?.problem === null;
  const rows = () => [
    ...(writable()
      ? [
          { act: () => single.set(!single.value()), id: "single" },
          { act: () => vim.set(!vim.value()), id: "vim" },
          { id: "commands" },
        ]
      : []),
    { act: () => pressKeys("?"), id: "map" },
  ];
  return (
    <View style={{ gap: 12 }}>
      <If when={settings()?.problem}>
        {(problem) => <FileProblem file={settings()!.file} problem={problem()} />}
      </If>
      <FieldRows rows={rows}>
        <If when={writable() ? keyboard() : undefined}>
          {(shown) => (
            <>
              <FieldRow
                {...words("Single-key shortcuts")}
                control={
                  <Switch
                    label={onOff(single.value())}
                    onChange={single.set}
                    pending={single.pending()}
                    value={single.value()}
                  />
                }
                from={fromWords(shown().singleKeyShortcuts, onOff)}
                icon="keyboard"
                id="single"
                overridden={isOverridden(shown().singleKeyShortcuts)}
                refusal={single.refusal()}
              />
              <FieldRow
                {...words("Vim mode")}
                control={
                  <Switch
                    label={onOff(vim.value())}
                    onChange={vim.set}
                    pending={vim.pending()}
                    value={vim.value()}
                  />
                }
                from={fromWords(shown().vimMode, onOff)}
                icon="square-terminal"
                id="vim"
                overridden={isOverridden(shown().vimMode)}
                refusal={vim.refusal()}
              />
              <FieldRow
                {...words("Vim commands")}
                from={`${fromWords(shown().vimCommands, (lines) => `${lines.length} lines`)}. The app's Vim does not run them yet: they are kept for when it does.`}
                icon="terminal"
                id="commands"
                refusal={commands.refusal()}
                under={
                  <View style={{ alignItems: "flex-start", gap: 8 }}>
                    <TextField
                      label="Vim commands"
                      onChange={commands.field.change}
                      onSave={() => void commands.submit()}
                      placeholder="imap jj <Esc>"
                      rows={{ max: 12, min: 3 }}
                      style={{ alignSelf: "stretch" }}
                      value={commands.field.text()}
                    />
                    <Button
                      disabled={!commands.field.dirty()}
                      icon="save"
                      label="Save the commands"
                      onPress={() => void commands.submit()}
                      pending={commands.pending()}
                    />
                  </View>
                }
              />
            </>
          )}
        </If>
        <FieldRow
          {...words("Key map")}
          control={<Button icon="keyboard" label="Show every key" onPress={() => pressKeys("?")} />}
          icon="list"
          id="map"
        />
      </FieldRows>
    </View>
  );
}
