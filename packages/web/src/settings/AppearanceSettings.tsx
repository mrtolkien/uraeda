// The settings' Appearance section: the mode, System, Light, or Dark, a theme for each mode, kept
// on this browser, and the user's theme files, each with a line saying what it is and its problems,
// as the core words them. The rows draw over the themes they are given, as the settings page reads
// them from the server, and a story passes fixed ones.
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Theme, ThemeFile } from "uraeda-binding";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { DEFAULTS, type Mode, type Picks, usePicks } from "../theme.tsx";
import { type Category, settingOf } from "./categories.ts";
import { SettingRow, SettingRows } from "./SettingRow.tsx";

/** What the section shows of the server's themes: the lists, the user's files, and their folder. */
export type AppearanceThemes = {
  files: ReadonlyArray<ThemeFile>;
  folder: string;
  themes: ReadonlyArray<Theme>;
};

/** A count and its noun, `1 problem`, `2 colours`, then what follows the noun. */
const counted = (count: number, noun: string, then = "") =>
  `${count} ${noun}${count === 1 ? "" : "s"}${then}`;

/** The name of a theme of the lists, by its id, compared without case. */
const nameOf = (themes: ReadonlyArray<Theme>, id: string | undefined) =>
  themes.find((theme) => theme.id.toLowerCase() === id?.toLowerCase())?.name;

/**
 * A file's line: its name, mode, and the theme it extends, by name when the lists hold it, then
 * how many colours it has under the contrast floor, and how many other problems.
 */
export function fileSummary(file: ThemeFile, themes: ReadonlyArray<Theme>): string {
  const extended = nameOf(themes, file.extends);
  const parts = [
    file.name,
    file.mode,
    file.extends && `extends ${extended ?? `"${file.extends}"`}`,
  ].filter(Boolean);
  // A colour under the floor counts once, though it is named on each ground it is under.
  const under = file.problems.filter((problem) => problem.isUnderFloor);
  const floor = new Set(under.map((problem) => problem.role ?? problem.message)).size;
  const others = file.problems.length - under.length;
  const counts = [
    others > 0 && counted(others, "problem"),
    floor > 0 && counted(floor, "colour", " under the contrast floor"),
  ].filter(Boolean);
  return [`${parts.join(", ")}.`, counts.length > 0 && `${counts.join(", ")}.`]
    .filter(Boolean)
    .join(" ");
}

/** The messages of `problems`, as the core words them, then `then`. */
const text = (problems: ReadonlyArray<{ message: string }>, then?: string) =>
  [...problems.map(({ message }) => message), then].filter(Boolean).join(" ");

/**
 * What becomes of a listed theme after its errors: a role's error leaves that role to the theme it
 * extends, its mode's default when it names none the lists hold; any other, the rest applies.
 */
function afterErrors(file: ThemeFile, errors: ThemeFile["problems"], themes: ReadonlyArray<Theme>) {
  const roles = errors.filter((problem) => problem.role !== undefined).length;
  // Each a sentence of its own: one role's, several roles', or the rest's.
  const mode = file.mode === "light" ? "light" : "dark";
  const extended = nameOf(themes, file.extends) ?? nameOf(themes, DEFAULTS[mode]);
  const kept =
    roles === 1
      ? `That role keeps its colour from ${extended}.`
      : `Those roles keep their colours from ${extended}.`;
  return [roles > 0 && kept, roles < errors.length && "The rest of the theme applies."]
    .filter(Boolean)
    .join(" ");
}

/**
 * A file's banners: its errors, then its warnings, each kind in one banner, the core's messages as
 * they are, then what becomes of the theme.
 */
function FileProblems({ file, themes }: { file: ThemeFile; themes: ReadonlyArray<Theme> }) {
  const errors = file.problems.filter((problem) => !problem.isWarning);
  const warnings = file.problems.filter((problem) => problem.isWarning);
  return (
    <>
      {errors.length > 0 && (
        <AnnouncedBanner
          collapsible={false}
          status="error"
          title={text(
            errors,
            file.isListed ? afterErrors(file, errors, themes) : "The theme is not in the lists.",
          )}
        />
      )}
      {warnings.length > 0 && (
        <AnnouncedBanner
          collapsible={false}
          status="warning"
          title={text(warnings, file.isListed ? "The theme applies as written." : undefined)}
        />
      )}
    </>
  );
}

/** Each theme file of the user's: its name, its line, and its problems. */
function Files({ themes }: { themes: AppearanceThemes }) {
  if (themes.files.length === 0) {
    return null;
  }
  return (
    <VStack gap={2}>
      {themes.files.map((file) => (
        <VStack gap={1} key={file.file}>
          <Text>
            <Text type="code">{file.file}</Text> {fileSummary(file, themes.themes)}
          </Text>
          <FileProblems file={file} themes={themes.themes} />
        </VStack>
      ))}
    </VStack>
  );
}

/** A mode's list: its themes, in the server's order, the user's marked "yours". */
function options(themes: ReadonlyArray<Theme>, mode: "dark" | "light") {
  return themes
    .filter((theme) => theme.mode === mode)
    .map((theme) => ({
      label: theme.isShipped ? theme.name : `${theme.name} · yours`,
      value: theme.id,
    }));
}

/** A mode's theme row: its list, the pick shown, or the mode's default when the list lacks it. */
function ThemeRow({
  category,
  mode,
  onPick,
  picks,
  themes,
}: {
  category: Category;
  mode: "dark" | "light";
  onPick: (next: Partial<Picks>) => void;
  picks: Picks;
  themes: ReadonlyArray<Theme>;
}) {
  const label = mode === "dark" ? "Dark theme" : "Light theme";
  const listed = options(themes, mode);
  const value = listed.some((option) => option.value === picks[mode])
    ? picks[mode]
    : DEFAULTS[mode];
  return (
    <SettingRow setting={settingOf(category, label)}>
      <Selector
        isLabelHidden
        label={label}
        onChange={(id: string) => onPick({ [mode]: id })}
        options={listed}
        presentation="popover"
        value={value}
        // As wide as the longest name, GitHub Dark High Contrast, and the arrow.
        width="32ch"
      />
    </SettingRow>
  );
}

/** The section's rows over `themes`, those `shows` keeps, with the picks given. */
export function AppearanceRows({
  category,
  onPick,
  picks,
  shows = () => true,
  themes,
}: {
  category: Category;
  onPick: (next: Partial<Picks>) => void;
  picks: Picks;
  shows?: (label: string) => boolean;
  themes: AppearanceThemes;
}) {
  const yours = settingOf(category, "Your themes");
  const row = { category, onPick, picks, themes: themes.themes };
  return (
    <SettingRows>
      {shows("Mode") && (
        <SettingRow setting={settingOf(category, "Mode")}>
          <SegmentedControl
            label="Mode"
            onChange={(mode: string) => onPick({ mode: mode as Mode })}
            value={picks.mode}
          >
            <SegmentedControlItem label="System" value="system" />
            <SegmentedControlItem label="Light" value="light" />
            <SegmentedControlItem label="Dark" value="dark" />
          </SegmentedControl>
        </SettingRow>
      )}
      {shows("Dark theme") && <ThemeRow mode="dark" {...row} />}
      {shows("Light theme") && <ThemeRow mode="light" {...row} />}
      {shows("Your themes") && (
        <SettingRow
          notes={<Files themes={themes} />}
          // The folder as the server names it, where the search reads "the themes folder".
          setting={{
            ...yours,
            help: yours.help.replace(
              "the themes folder, beside config.toml",
              themes.folder || "the themes folder, beside config.toml",
            ),
          }}
        />
      )}
    </SettingRows>
  );
}

/** The section, over the server's themes and this browser's picks. */
export function AppearanceSettings({
  category,
  shows,
  themes,
}: {
  category: Category;
  shows: (label: string) => boolean;
  themes: AppearanceThemes;
}) {
  const [picks, pick] = usePicks();
  return (
    <AppearanceRows category={category} onPick={pick} picks={picks} shows={shows} themes={themes} />
  );
}
