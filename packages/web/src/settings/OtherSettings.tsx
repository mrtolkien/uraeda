// The sections besides Server and Runs: the colour scheme, signing out, and the settings later
// features bring, each a row of the form.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { VStack } from "@astryxdesign/core/VStack";
import { useSignOut, useSignOutEverywhere } from "../sign-in/useSignOut.ts";
import { type Scheme, useScheme } from "../theme.tsx";
import { type Category, PLANNED_ICON, plannedHelp, settingOf } from "./categories.ts";
import { SettingRow, SettingRows, useRefusal } from "./SettingRow.tsx";

/** The colour scheme, kept in this browser: Mocha, Latte, or the system's. */
export function AppearanceSettings({ category }: { category: Category }) {
  const [scheme, setScheme] = useScheme();
  return (
    <SettingRows>
      <SettingRow setting={settingOf(category, "Colour scheme")}>
        <SegmentedControl
          label="Colour scheme"
          onChange={(value: string) => setScheme(value as Scheme)}
          value={scheme}
        >
          <SegmentedControlItem label="Mocha" value="mocha" />
          <SegmentedControlItem label="Latte" value="latte" />
          <SegmentedControlItem label="System" value="system" />
        </SegmentedControl>
      </SettingRow>
    </SettingRows>
  );
}

/**
 * Sign out this browser, or every device after asking, the rows that `shows` keeps, with the error
 * of the last one the server refused or never got.
 */
export function SignInSettings({
  category,
  shows,
}: {
  category: Category;
  shows: (label: string) => boolean;
}) {
  const { signOut } = useSignOut();
  const [refused, setRefused] = useRefusal("Sign out");
  const everywhere = useSignOutEverywhere();
  const problem = refused ?? everywhere.failed;
  return (
    <VStack>
      {problem && (
        <VStack padding={3}>
          <AnnouncedBanner collapsible={false} status="error" title={problem} />
        </VStack>
      )}
      <SettingRows>
        {shows("Sign out") && (
          <SettingRow setting={settingOf(category, "Sign out")}>
            <Button
              label="Sign out"
              onClick={async () => {
                setRefused(undefined);
                setRefused(await signOut());
              }}
            />
          </SettingRow>
        )}
        {shows("Sign out everywhere") && (
          <SettingRow setting={settingOf(category, "Sign out everywhere")}>
            <Button
              label="Sign out everywhere…"
              onClick={() => {
                setRefused(undefined);
                everywhere.ask();
              }}
              variant="destructive"
            />
          </SettingRow>
        )}
      </SettingRows>
    </VStack>
  );
}

/**
 * The rows of the settings later features bring to a section, that `shows` keeps: each with the
 * feature that brings it, and no control.
 */
export function PlannedRows({
  category,
  shows,
}: {
  category: Category;
  shows: (label: string) => boolean;
}) {
  return (category.planned ?? [])
    .filter((setting) => shows(setting.label))
    .map((setting) => (
      <SettingRow
        key={setting.label}
        setting={{ help: plannedHelp(setting), icon: PLANNED_ICON, label: setting.label }}
      />
    ));
}

/** A section whose settings later features bring, the rows that `shows` keeps. */
export function PlannedSettings({
  category,
  shows,
}: {
  category: Category;
  shows: (label: string) => boolean;
}) {
  return (
    <SettingRows>
      <PlannedRows category={category} shows={shows} />
    </SettingRows>
  );
}
