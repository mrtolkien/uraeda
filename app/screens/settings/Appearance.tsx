// The Appearance category, kept on this device: the mode, then each mode's theme, every theme drawn
// in its own colours, and the owner's theme files with their problems, as the core words them.
// Enter on a theme's row opens the leader's theme picker, `Space u t`, which picks the same way.
import { View } from "nsh";
import { wordsOf } from "./categories";
import { chooseMode, chooseTheme, themeChoice } from "./look";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { openPicker } from "../shell/pickers";
import { record } from "../../store";
import type { Theme, ThemeFile } from "../../store/protocol";
import { Banner, type Option, Segmented, Text } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { ThemeSample } from "../../ui/lists";
import type { ThemeChoice } from "../../ui/theme";
import { DEFAULT_THEMES, type Mode } from "../../ui/tokens";

const ON_DEVICE = "Kept on this device: each device picks its own";

const MODES: ReadonlyArray<Option<ThemeChoice["mode"]>> = [
  { icon: "monitor", label: "System", value: "system" },
  { icon: "sun", label: "Light", value: "light" },
  { icon: "moon", label: "Dark", value: "dark" },
];

/** The next mode, as `Space u m` cycles them. */
const NEXT = { dark: "system", light: "dark", system: "light" } as const;

/** A count and its noun: "1 problem", "2 colours". */
const counted = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/** A file's line: its mode, the theme it extends, and how many problems it has. */
function fileLine(file: ThemeFile): string {
  const parts = [file.mode ?? "no mode", file.extends === null ? null : `extends ${file.extends}`];
  const floor = new Set(file.problems.filter((one) => one.isUnderFloor).map((one) => one.role))
    .size;
  const others = file.problems.filter((one) => !one.isUnderFloor).length;
  const counts = [
    others > 0 ? counted(others, "problem") : null,
    floor > 0 ? `${counted(floor, "colour")} under the contrast floor` : null,
  ];
  return [...parts, ...counts].filter((one) => one !== null).join(" · ");
}

/** Problems' messages, as the core words them, one after the other. */
const words = (problems: ReadonlyArray<{ message: string }>) =>
  problems.map((one) => one.message).join(" ");

/** A theme file of the owner's: its name and line, then its errors and its warnings. */
function FileCard(props: { file: ThemeFile }) {
  const errors = () => props.file.problems.filter((one) => !one.isWarning);
  const warnings = () => props.file.problems.filter((one) => one.isWarning);
  return (
    <View style={{ gap: 6 }}>
      <Text>
        <Text font="code">{props.file.file}</Text>
        {` · ${fileLine(props.file)}`}
      </Text>
      <If when={errors().length > 0}>
        <Banner
          title={
            props.file.isListed
              ? "A role keeps the colour of the theme it extends"
              : "Not in the lists"
          }
          tone="danger"
        >
          {words(errors())}
        </Banner>
      </If>
      <If when={warnings().length > 0}>
        <Banner title="It applies as written" tone="caution">
          {words(warnings())}
        </Banner>
      </If>
    </View>
  );
}

/** A mode's themes, each in its own colours, the one picked marked; a press picks it. */
function Themes(props: { choice: ThemeChoice; mode: Mode; themes: ReadonlyArray<Theme> }) {
  // Two to a line on a phone, as many as fit wider.
  const pane = usePane();
  const width = () => (pane.width() === "narrow" ? 156 : 196);
  const listed = () => props.themes.filter((one) => one.mode === props.mode);
  const picked = () => {
    const id = props.choice[props.mode];
    return listed().some((one) => one.id === id) ? id : DEFAULT_THEMES[props.mode].id;
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <Each key={(theme: Theme) => theme.id} of={listed()}>
        {(theme) => (
          <ThemeSample
            name={theme().name}
            note={theme().isShipped ? undefined : "yours"}
            onPress={() => chooseTheme(theme(), false)}
            picked={theme().id === picked()}
            roles={theme().roles}
            testID={`theme-${theme().id}`}
            width={width()}
          />
        )}
      </Each>
    </View>
  );
}

export function Appearance() {
  const themes = record("Themes", null);
  const choice = themeChoice;
  const listed = () => themes()?.themes ?? [];
  const rows = () => [
    { act: () => chooseMode(NEXT[choice().mode]), id: "mode" },
    { act: () => openPicker("themes"), id: "dark" },
    { act: () => openPicker("themes"), id: "light" },
    { id: "yours" },
  ];
  const yours = wordsOf("appearance", "Your themes");
  return (
    <FieldRows rows={rows}>
      <FieldRow
        {...wordsOf("appearance", "Mode")}
        control={
          <Segmented label="Mode" onChange={chooseMode} options={MODES} value={choice().mode} />
        }
        from={ON_DEVICE}
        icon="sun"
        id="mode"
      />
      <FieldRow
        {...wordsOf("appearance", "Dark theme")}
        from={ON_DEVICE}
        icon="moon"
        id="dark"
        under={<Themes choice={choice()} mode="dark" themes={listed()} />}
      />
      <FieldRow
        {...wordsOf("appearance", "Light theme")}
        from={ON_DEVICE}
        icon="sun"
        id="light"
        under={<Themes choice={choice()} mode="light" themes={listed()} />}
      />
      <FieldRow
        help={yours.help.replace("the themes folder", themes()?.folder || "the themes folder")}
        icon="swatch-book"
        id="yours"
        label={yours.label}
        under={
          <If
            when={(themes()?.files.length ?? 0) > 0}
            else={
              <Text tone="faint">
                None yet. Copy a shipped theme from the documentation's Colour themes to start.
              </Text>
            }
          >
            <View style={{ gap: 10 }}>
              <Each key={(file: ThemeFile) => file.file} of={themes()?.files ?? []}>
                {(file) => <FileCard file={file()} />}
              </Each>
            </View>
          </If>
        }
      />
    </FieldRows>
  );
}
