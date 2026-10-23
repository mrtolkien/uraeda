// The Runs section: whether the run after a spec's approval starts in a fresh session, the default
// the approval's own switch starts from, then the run settings later features bring.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Switch } from "@astryxdesign/core/Switch";
import { VStack } from "@astryxdesign/core/VStack";
import { type Category, settingOf } from "./categories.ts";
import { PlannedRows } from "./OtherSettings.tsx";
import { SettingRow, SettingRows, useRefusal } from "./SettingRow.tsx";
import { FileProblem, type ServerActions, type ServerValues } from "./ServerSettings.tsx";

/** Building in a fresh session, saved at once, with its refusal under it. */
function BuildFresh({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const setting = settingOf(category, "Build in a fresh session");
  const [refused, setRefused] = useRefusal(setting.label);
  return (
    <SettingRow
      notes={refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
      setting={setting}
    >
      <Switch
        isLabelHidden
        label={setting.label}
        onChange={async (fresh: boolean) => {
          setRefused(undefined);
          setRefused(await actions.setBuildInFreshSession(fresh));
        }}
        value={values.runs.buildInFreshSession.inForce}
      />
    </SettingRow>
  );
}

/**
 * The Runs section's rows that `shows` keeps, the settings to come included; the file's problem
 * in place of its switch when the file cannot be read.
 */
export function RunSettings({
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
        {!values.problem && shows("Build in a fresh session") && (
          <BuildFresh actions={actions} category={category} values={values} />
        )}
        <PlannedRows category={category} shows={shows} />
      </SettingRows>
    </VStack>
  );
}
