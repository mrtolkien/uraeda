// The categories besides Server: the theme, signing out, and the settings later features bring.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useSignOut, useSignOutEverywhere } from "../sign-in/useSignOut.ts";
import { type ThemeMode, useThemeMode } from "../theme.tsx";
import type { Category } from "./categories.ts";

/** The theme, kept in this browser, as the sidebar kept it before. */
export function AppearanceSettings() {
  const [mode, setMode] = useThemeMode();
  return (
    <VStack gap={4}>
      <Heading level={2}>Appearance</Heading>
      <SegmentedControl
        label="Theme"
        onChange={(value: string) => setMode(value as ThemeMode)}
        value={mode}
      >
        <SegmentedControlItem label="System" value="system" />
        <SegmentedControlItem label="Light" value="light" />
        <SegmentedControlItem label="Dark" value="dark" />
      </SegmentedControl>
      <Text color="secondary">Kept on this browser only: each device picks its own.</Text>
    </VStack>
  );
}

/**
 * Sign out this browser, or every device after asking, with the error of the last one the server
 * refused or never got.
 */
export function SignInSettings() {
  const { signOut } = useSignOut();
  const [refused, setRefused] = useState<string>();
  const everywhere = useSignOutEverywhere();
  const problem = refused ?? everywhere.failed;
  return (
    <VStack gap={4}>
      <Heading level={2}>Sign-in</Heading>
      {problem && <Banner collapsible={false} status="error" title={problem} />}
      <VStack gap={2}>
        <HStack>
          <Button
            label="Sign out"
            onClick={async () => {
              setRefused(undefined);
              setRefused(await signOut());
            }}
          />
        </HStack>
        <Text color="secondary">This browser will need the access key again.</Text>
      </VStack>
      <VStack gap={2}>
        <HStack>
          <Button
            label="Sign out everywhere…"
            onClick={() => {
              setRefused(undefined);
              everywhere.ask();
            }}
            variant="destructive"
          />
        </HStack>
        <Text color="secondary">
          Every browser signed in to Uraeda, this one included, will need the access key again.
        </Text>
      </VStack>
    </VStack>
  );
}

/** A category whose settings later features bring: each, with the feature that brings it. */
export function PlannedSettings({ category }: { category: Category }) {
  return (
    <VStack gap={4}>
      <Heading level={2}>{category.label}</Heading>
      <Text color="secondary">These settings come with later features.</Text>
      <List aria-label={`${category.label}, coming later`} hasDividers>
        {(category.planned ?? []).map((setting) => (
          <ListItem
            // Nodes, not strings, so a long line wraps instead of being cut.
            description={<>Comes with {setting.feature}</>}
            key={setting.label}
            label={<>{setting.label}</>}
          />
        ))}
      </List>
    </VStack>
  );
}
