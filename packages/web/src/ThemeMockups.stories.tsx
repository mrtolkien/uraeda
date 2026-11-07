// The colour themes' mockups (`specs/2026-11-07-color-themes/spec.md`): the settings' Appearance
// section, with the mode, a theme for each mode, and your theme files, their problems included; the
// theme picker of `Space u t`, a list over the app, which is the preview, fading after a second; and a document's headings, a colour per level. Built from the real
// components over fixed text, with no server: the stories show the look, and the data is the real
// page's once built.
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { ThemeFile } from "uraeda-binding";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { Home } from "./Home.tsx";
import { glassStyles } from "./layout/glass.ts";
import { headingStyle } from "./layout/headings.ts";
import { pickedStyles } from "./layout/picked.ts";
import { TextLine } from "./fields/TextLine.tsx";
import { Pane } from "./layout/Pane.tsx";
import { AppearanceRows } from "./settings/AppearanceSettings.tsx";
import { categoryOf } from "./settings/categories.ts";
import { SAMPLE_FILES, sampleThemes } from "./settings/sampleThemes.ts";
import { Shell } from "./Shell.tsx";
import type { Picks } from "./theme.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The theme picker: a narrow list at the top of the page, over the app with no scrim.
  picker: {
    insetInlineStart: "50%",
    maxHeight: "var(--size-palette-height)",
    position: "fixed",
    top: spacingVars["--spacing-10"],
    transform: "translateX(-50%)",
    transitionDuration: "200ms",
    transitionProperty: "opacity",
    width: "var(--size-palette-list)",
    zIndex: 10,
  },
  // A second on one row: the list nearly gone, the page whole behind it.
  faded: { opacity: 0.1 },
  pickerField: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  pickerList: { listStyle: "none", margin: 0, overflowY: "auto", padding: 0 },
  pickerRow: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** The shipped dark themes, as the picker lists them. */
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
/**
 * The settings' Appearance section, its real rows over fixed themes: the mode, a theme for each,
 * and your theme files, or none.
 */
function Appearance({
  files,
  mode,
}: {
  files: ReadonlyArray<ThemeFile>;
  mode: "system" | "light" | "dark";
}) {
  const [picks, setPicks] = useState<Picks>({
    dark: "catppuccin-mocha",
    light: "catppuccin-latte",
    mode,
  });
  return (
    <VStack xstyle={styles.page}>
      <Pane title="Appearance">
        <AppearanceRows
          category={categoryOf("appearance")!}
          onPick={(next) => setPicks((before) => ({ ...before, ...next }))}
          picks={picks}
          themes={{ ...sampleThemes(files.length > 0), files }}
        />
      </Pane>
    </VStack>
  );
}

/** A row of the picker: a theme's name and mode, the ones in use marked. */
type Row = { inUse?: boolean; mode: "dark" | "light"; name: string };

const ROWS: ReadonlyArray<Row> = [
  { inUse: true, mode: "dark", name: "Catppuccin Mocha" },
  ...DARK.slice(1, 9).map((name) => ({ mode: "dark" as const, name })),
];

/**
 * `Space u t`: a narrow list of every theme, dark ones first, over the app with no scrim: the app
 * itself is the preview, drawn in the theme under the cursor. After a second on one row, the list
 * fades to 10% (`isFaded`), and the whole page shows; a key or the pointer brings it back.
 */
function Picker({ isFaded = false }: { isFaded?: boolean }) {
  return (
    <>
      <Shell>
        <Home />
      </Shell>
      <VStack
        aria-label="Theme"
        role="dialog"
        xstyle={[glassStyles.surface, glassStyles.floating, styles.picker, isFaded && styles.faded]}
      >
        <VStack xstyle={styles.pickerField}>
          <TextLine
            isLabelHidden
            label="Theme"
            onChange={() => {}}
            placeholder="Find a theme…"
            value=""
          />
        </VStack>
        <VStack as="ul" xstyle={styles.pickerList}>
          {ROWS.map((row, at) => (
            <HStack
              as="li"
              gap={2}
              justify="space-between"
              key={row.name}
              xstyle={[styles.pickerRow, at === 3 && pickedStyles.picked]}
            >
              <Text>{row.name}</Text>
              <Text color="secondary" type="supporting">
                {row.mode}
                {row.inUse ? " · in use" : ""}
              </Text>
            </HStack>
          ))}
        </VStack>
        <Text color="secondary" type="supporting" xstyle={styles.pickerField}>
          Enter keeps Dracula · Esc puts Catppuccin Mocha back
        </Text>
      </VStack>
    </>
  );
}

/** A document's headings, a colour per level: the page's title, a section, and a question. */
function Headings() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Heading level={1} xstyle={headingStyle(1)}>
        Spec: Color themes
      </Heading>
      <Text>
        The web UI&rsquo;s colours come from a colour theme, one for light mode and one for dark
        mode.
      </Text>
      <Heading level={2} xstyle={headingStyle(2)}>
        User stories
      </Heading>
      <Heading level={3} xstyle={headingStyle(3)}>
        US1: Pick a theme for each mode (P1)
      </Heading>
      <Text>
        In the settings&rsquo; Appearance, the mode follows the system, and a list per mode picks
        its theme.
      </Text>
      <Heading level={3} xstyle={headingStyle(3)}>
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
export const AppearanceSection: Story = { args: { files: SAMPLE_FILES, mode: "system" } };

/** No theme of yours yet: the row says where to put one. */
export const NoThemesYet: Story = { args: { files: [], mode: "dark" } };

/** `Space u t`, open over Home, the cursor on Dracula: the app behind is the preview. */
export const ThemePicker: Story = {
  args: { files: [], mode: "system" },
  decorators: [inRepositoryFolder],
  render: () => <Picker />,
};

/** A second on Dracula: the list fades to 10%, and the page shows whole in the theme. */
export const ThemePickerFaded: Story = {
  args: { files: [], mode: "system" },
  decorators: [inRepositoryFolder],
  render: () => <Picker isFaded />,
};

/** A spec's headings in Catppuccin Mocha: mauve, blue, then green. */
export const HeadingsByLevel: Story = {
  args: { files: [], mode: "dark" },
  render: () => <Headings />,
};
