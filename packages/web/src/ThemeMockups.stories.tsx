// The colour themes' mockups (`specs/2026-11-07-color-themes/spec.md`): the settings' Appearance
// section, with the mode, a theme for each mode, and your theme files, their problems included; the
// theme picker of `Space u t`; and a document's headings, a colour per level. Built from the real
// components over fixed text, with no server: the stories show the look, and the data is the real
// page's once built. TEMPORARY: the headings' colours stand in for the heading roles until they
// exist.
import { Heading } from "@astryxdesign/core/Heading";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { Home } from "./Home.tsx";
import { KeyPicker } from "./keys/KeyPicker.tsx";
import { markdownPreview, type PickerItem } from "./keys/pickerSources.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Pane } from "./layout/Pane.tsx";
import { SettingRow, SettingRows } from "./settings/SettingRow.tsx";
import { Shell } from "./Shell.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The heading roles of Catppuccin, standing in: mauve, blue, and green, one per level.
  heading1: { color: colorVars["--color-text-accent"] },
  heading2: { color: colorVars["--color-text-blue"] },
  heading3: { color: colorVars["--color-text-green"] },
});

/** The shipped themes, by mode, as the lists show them; yours after them. */
const DARK = [
  "Catppuccin Mocha",
  "Catppuccin Macchiato",
  "Catppuccin Frappé",
  "Dracula",
  "GitHub Dark",
  "GitHub Dark Dimmed",
  "GitHub Dark High Contrast",
  "Gruvbox Dark",
  "Kanagawa Dragon",
  "Kanagawa Wave",
  "Nord",
  "One Dark",
  "Rosé Pine",
  "Rosé Pine Moon",
  "Solarized Dark",
  "Tokyo Night",
  "Tokyo Night Moon",
  "Tokyo Night Storm",
];
const LIGHT = [
  "Catppuccin Latte",
  "Alucard",
  "GitHub Light",
  "GitHub Light High Contrast",
  "Gruvbox Light",
  "Kanagawa Lotus",
  "One Light",
  "Rosé Pine Dawn",
  "Solarized Light",
  "Tokyo Night Light",
];

const options = (names: ReadonlyArray<string>, yours: ReadonlyArray<string>) => [
  ...names.map((label) => ({ label, value: label })),
  ...yours.map((label) => ({ label: `${label} · yours`, value: label })),
];

/** A theme file of yours, and what its row says. */
type File = { name: string; problem?: string; status?: "error" | "warning"; text: string };

const FILES: ReadonlyArray<File> = [
  { name: "ember.toml", text: "Ember, dark, extends Catppuccin Mocha." },
  {
    name: "dusk.toml",
    problem:
      "ink-faint is 3.1:1 on page, under 4.5. rule is 2.4:1 on page, under 3. The theme applies as written.",
    status: "warning",
    text: "Dusk, light, extends Catppuccin Latte. 2 colours under the contrast floor.",
  },
  {
    name: "broken.toml",
    problem:
      'Line 9: needs-you names "embr", which is not in the palette. That role keeps its colour from Catppuccin Mocha.',
    status: "error",
    text: "Broken, dark. 1 problem.",
  },
];

/** The settings' Appearance section: the mode, a theme for each, and your theme files. */
function Appearance({
  files,
  mode,
}: {
  files: ReadonlyArray<File>;
  mode: "system" | "light" | "dark";
}) {
  return (
    <VStack xstyle={styles.page}>
      <Pane title="Appearance">
        <SettingRows>
          <SettingRow
            setting={{
              help: "System follows this device: the light theme by day, the dark theme by night. Kept on this browser only: each device picks its own.",
              icon: "uraeda:palette",
              label: "Mode",
            }}
          >
            <SegmentedControl label="Mode" onChange={() => {}} value={mode}>
              <SegmentedControlItem label="System" value="system" />
              <SegmentedControlItem label="Light" value="light" />
              <SegmentedControlItem label="Dark" value="dark" />
            </SegmentedControl>
          </SettingRow>
          <SettingRow
            setting={{
              help: "The theme of dark mode. Space u t previews each theme as you move through the list.",
              icon: "uraeda:palette",
              label: "Dark theme",
            }}
          >
            <Selector
              isLabelHidden
              label="Dark theme"
              onChange={() => {}}
              options={options(DARK, ["Broken", "Ember"])}
              presentation="popover"
              value="Catppuccin Mocha"
              width="32ch"
            />
          </SettingRow>
          <SettingRow
            setting={{
              help: "The theme of light mode.",
              icon: "uraeda:palette",
              label: "Light theme",
            }}
          >
            <Selector
              isLabelHidden
              label="Light theme"
              onChange={() => {}}
              options={options(LIGHT, ["Dusk"])}
              presentation="popover"
              value="Catppuccin Latte"
              width="32ch"
            />
          </SettingRow>
          <SettingRow
            notes={
              <VStack gap={2}>
                {files.map((file) => (
                  <VStack gap={1} key={file.name}>
                    <Text>
                      <Text type="code">{file.name}</Text> {file.text}
                    </Text>
                    {file.problem && file.status && (
                      <AnnouncedBanner
                        collapsible={false}
                        status={file.status}
                        title={file.problem}
                      />
                    )}
                  </VStack>
                ))}
              </VStack>
            }
            setting={{
              help: "One TOML file per theme in ~/.config/uraeda/themes/. A file saved there shows in its mode's list at once. Copy a shipped theme from the documentation to start.",
              icon: "uraeda:palette",
              label: "Your themes",
            }}
          />
        </SettingRows>
      </Pane>
    </VStack>
  );
}

/** What each theme's preview shows: a document's headings, prose, a list, and code. */
const SAMPLE = `# Color themes

Pick a theme for light mode and one for dark mode.

## Questions

### Q1: Which themes ship?

- **A (recommended).** Every free variant.
- **B.** One per family.

\`\`\`ts
export function next(spec: Spec) {
  return spec.rounds[0] ?? "discovery";
}
\`\`\`
`;

/** A picker's row for a theme: its name, its mode, and the one in use marked. */
const item = (name: string, mode: "dark" | "light", inUse = false): PickerItem => ({
  icon: "uraeda:palette",
  id: name,
  kind: "notes",
  path: "",
  preview: markdownPreview(SAMPLE),
  title: `${name} · ${mode}${inUse ? " · in use" : ""}`,
});

const PICKER: ReadonlyArray<PickerItem> = [
  item("Catppuccin Mocha", "dark", true),
  ...DARK.slice(1).map((name) => item(name, "dark")),
  item("Ember", "dark"),
  item("Catppuccin Latte", "light", true),
  ...LIGHT.slice(1).map((name) => item(name, "light")),
  item("Dusk", "light"),
];

/** `Space u t`: every theme, the dark ones first; the page shows the one under the cursor. */
function Picker() {
  return (
    <>
      <Shell>
        <Home />
      </Shell>
      <KeyPicker isOpen items={PICKER} onClose={() => {}} onPick={() => {}} title="Theme" />
    </>
  );
}

/** A document's headings, a colour per level: the page's title, a section, and a question. */
function Headings() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Heading level={1} xstyle={styles.heading1}>
        Spec: Color themes
      </Heading>
      <Text>
        The web UI&rsquo;s colours come from a colour theme, one for light mode and one for dark
        mode.
      </Text>
      <Heading level={2} xstyle={styles.heading2}>
        User stories
      </Heading>
      <Heading level={3} xstyle={styles.heading3}>
        US1: Pick a theme for each mode (P1)
      </Heading>
      <Text>
        In the settings&rsquo; Appearance, the mode follows the system, and a list per mode picks
        its theme.
      </Text>
      <Heading level={3} xstyle={styles.heading3}>
        US2: Write a theme of your own (P2)
      </Heading>
      <Text>
        A TOML file in the themes folder shows in its mode&rsquo;s list as soon as it is saved.
      </Text>
    </VStack>
  );
}

const meta = {
  component: Appearance,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Colour themes",
} satisfies Meta<typeof Appearance>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The Appearance section: System mode, the default themes, and three theme files of yours. */
export const AppearanceSection: Story = { args: { files: FILES, mode: "system" } };

/** No theme of yours yet: the row says where to put one. */
export const NoThemesYet: Story = { args: { files: [], mode: "dark" } };

/** `Space u t`, open over Home: the list of themes, the one in use marked, its preview beside. */
export const ThemePicker: Story = {
  args: { files: [], mode: "system" },
  decorators: [inRepositoryFolder],
  render: () => <Picker />,
};

/** A spec's headings in Catppuccin Mocha: mauve, blue, then green. */
export const HeadingsByLevel: Story = {
  args: { files: [], mode: "dark" },
  render: () => <Headings />,
};
