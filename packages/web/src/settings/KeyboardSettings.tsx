// The Keyboard section: whether the single-key shortcuts act, saved at once. With them off, the
// leader, the `g` sequences, and every letter key stop; named keys and Ctrl or Cmd+K stay.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Switch } from "@astryxdesign/core/Switch";
import { VStack } from "@astryxdesign/core/VStack";
import { type Category, settingOf } from "./categories.ts";
import { SettingRow, SettingRows, useRefusal } from "./SettingRow.tsx";
import { FileProblem, type ServerActions, type ServerValues } from "./ServerSettings.tsx";

/** The single-key shortcuts' switch, saved at once, with its refusal under it. */
function SingleKeys({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const setting = settingOf(category, "Single-key shortcuts");
  const [refused, setRefused] = useRefusal(setting.label);
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
          setRefused(await actions.setSingleKeyShortcuts(on));
        }}
        value={values.keyboard.singleKeyShortcuts.inForce}
      />
    </SettingRow>
  );
}

/**
 * The Keyboard section's row, when `shows` keeps it; the file's problem in place of its switch
 * when the file cannot be read, while the shortcuts stay on.
 */
export function KeyboardSettings({
  actions,
  category,
  shows,
  values,
}: {
  actions: ServerActions;
  category: Category;
  shows: (label: string) => boolean;
  values: ServerValues;
}) {
  return (
    <VStack>
      {values.problem && <FileProblem problem={values.problem} />}
      <SettingRows>
        {!values.problem && shows("Single-key shortcuts") && (
          <SingleKeys actions={actions} category={category} values={values} />
        )}
      </SettingRows>
    </VStack>
  );
}
