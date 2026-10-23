// The categories besides Server: the colour scheme, signing out, and the settings later features bring.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import { useSignOut, useSignOutEverywhere } from "../sign-in/useSignOut.ts";
import { type Scheme, useScheme } from "../theme.tsx";
import type { Category } from "./categories.ts";

/** The colour scheme, kept in this browser: Mocha, Latte, or the system's. */
export function AppearanceSettings() {
  const [scheme, setScheme] = useScheme();
  return (
    <VStack gap={4}>
      <Heading level={2}>Appearance</Heading>
      <SegmentedControl
        label="Colour scheme"
        onChange={(value: string) => setScheme(value as Scheme)}
        value={scheme}
      >
        <SegmentedControlItem label="Mocha" value="mocha" />
        <SegmentedControlItem label="Latte" value="latte" />
        <SegmentedControlItem label="System" value="system" />
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
      {problem && <AnnouncedBanner collapsible={false} status="error" title={problem} />}
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
      <PlannedList category={category} />
    </VStack>
  );
}

/** The settings later features bring to a category, each with the feature that brings it. */
export function PlannedList({ category }: { category: Category }) {
  return (
    <VStack gap={4}>
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
