// The Keyboard section's Vim rows: the Vim mode switch, saved at once, and the human's Vim commands,
// one per line in a field saved with Save or Ctrl+Enter, each line the engine refuses shown under
// it with the engine's own message, as `mockups/vim.html` draws them.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { FieldStatus } from "@astryxdesign/core/FieldStatus";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { SaveKeys } from "../fields/SaveKeys.tsx";
import { TextField } from "../fields/TextField.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { useVimErrors } from "../fields/editor/vim/load.ts";
import { type Category, settingOf } from "./categories.ts";
import { SettingRow, useRefusal } from "./SettingRow.tsx";
import type { ServerActions, ServerValues } from "./ServerSettings.tsx";

type Props = { actions: ServerActions; category: Category; values: ServerValues };

/** The Vim mode switch, saved at once, with its refusal under it. */
export function VimMode({ actions, category, values }: Props) {
  const setting = settingOf(category, "Vim mode");
  const [refused, setRefused] = useRefusal(setting.label);
  const { vimMode } = values.keyboard;
  return (
    <SettingRow
      notes={refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
      setting={setting}
    >
      <Switch
        isLabelHidden
        label={setting.label}
        onChange={async (on: boolean) => {
          setRefused(undefined);
          setRefused(await actions.setVimMode(on));
        }}
        value={vimMode.saved ?? vimMode.inForce}
      />
    </SettingRow>
  );
}

/** The lines of a commands field's text, blank lines left out. */
const linesOf = (text: string) => text.split("\n").filter((line) => line.trim() !== "");

/**
 * The human's Vim commands, one per line, kept unsaved until Save or Ctrl+Enter saves them as the
 * file's list; the engine's errors, from its last start, under the field.
 */
export function VimCommands({ actions, category, values }: Props) {
  const setting = settingOf(category, "Vim commands");
  const [refused, setRefused] = useRefusal(setting.label);
  const { vimCommands } = values.keyboard;
  const field = useTextField(
    "settings#vim-commands",
    (vimCommands.saved ?? vimCommands.inForce).join("\n"),
  );
  const errors = useVimErrors();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const text = field.text;
    setSaving(true);
    setRefused(undefined);
    const refusal = await actions.setVimCommands(linesOf(text));
    setSaving(false);
    setRefused(refusal);
    if (!refusal) {
      field.saved(text);
    }
  };
  return (
    <SettingRow
      notes={
        <VStack gap={2}>
          <TextField
            isLabelHidden
            kind="comment"
            label={setting.label}
            onChange={field.change}
            onSubmit={() => void save()}
            placeholder="imap jj <Esc>"
            value={field.text}
          />
          {errors.map((error) => (
            <FieldStatus key={error} message={error} type="error" variant="detached" />
          ))}
          {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
          <HStack align="center" gap={3}>
            <Button
              isDisabled={!field.dirty || saving}
              label="Save"
              onClick={() => void save()}
              variant="secondary"
            />
            <SaveKeys />
          </HStack>
        </VStack>
      }
      setting={setting}
    />
  );
}
