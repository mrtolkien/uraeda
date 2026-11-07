// The colour themes' mockups (`specs/2026-11-07-color-themes/spec.md`): the settings' Appearance
// section, with the mode, a theme for each mode, and your theme files, their problems included; the
// theme picker of `Space u t`, a list over the app, which is the preview, fading after a second; and
// a document's headings, a colour per level. Built from the real components over fixed text; the
// picker is the real one, over the themes the story's server serves.
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Theme } from "@astryxdesign/core/theme";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useState } from "react";
import type { ThemeFile } from "uraeda-binding";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { Home } from "./Home.tsx";
import { headingStyle } from "./layout/headings.ts";
import { Pane } from "./layout/Pane.tsx";
import { AppearanceRows } from "./settings/AppearanceSettings.tsx";
import { categoryOf } from "./settings/categories.ts";
import { SAMPLE_FILES, sampleThemes } from "./settings/sampleThemes.ts";
import { ThemePicker as RealThemePicker } from "./keys/ThemePicker.tsx";
import { Shell } from "./Shell.tsx";
import { type Picks, ThemeProvider, ThemesFeed } from "./theme.tsx";
import { uraedaTheme } from "./theme/built/uraeda.js";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

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

/**
 * `Space u t`, the real `ThemePicker`, open over Home, over the themes the story's server serves:
 * the app behind is the preview, drawn in the theme under the cursor as it moves. Left a second
 * with no key and no pointer move, the list fades to 10%, and the whole page shows; a key or the
 * pointer brings it back. Escape closes it, putting back the theme in use.
 */
function Picker() {
  const [isOpen, setOpen] = useState(true);
  return (
    <ThemeProvider>
      {(mode) => (
        <Theme mode={mode} theme={uraedaTheme}>
          <Suspense fallback={null}>
            <ThemesFeed />
          </Suspense>
          <Shell>
            <Home />
          </Shell>
          <RealThemePicker isOpen={isOpen} onClose={() => setOpen(false)} />
        </Theme>
      )}
    </ThemeProvider>
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

/** `Space u t`, open over Home, the cursor on the theme in use: the app behind is the preview. */
export const ThemePicker: Story = {
  args: { files: [], mode: "system" },
  decorators: [inRepositoryFolder],
  render: () => <Picker />,
};

/**
 * The same picker, to watch it left alone: after a second with no key and no pointer move, the
 * list fades to 10%, and the page shows whole in the theme.
 */
export const ThemePickerFaded: Story = {
  args: { files: [], mode: "system" },
  decorators: [inRepositoryFolder],
  render: () => <Picker />,
};

/** A spec's headings in Catppuccin Mocha: mauve, blue, then green. */
export const HeadingsByLevel: Story = {
  args: { files: [], mode: "dark" },
  render: () => <Headings />,
};
