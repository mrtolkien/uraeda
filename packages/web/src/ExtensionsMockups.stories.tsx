// The extensions system's mockups (`specs/2026-11-08-extensions-system/spec.md`): the leader menu
// with the inbox turned off and two of your places in it, and a place one of your extensions draws, the "deploy" example, in the shell. Built from the real
// components over fixed text. The settings' Extensions section is the real one now, in
// `settings/SettingsView.stories.tsx`.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { DESTINATIONS } from "./destinations.ts";
import { Home } from "./Home.tsx";
import { LeaderMenu, type MenuEntry } from "./keys/LeaderMenu.tsx";
import { Pane } from "./layout/Pane.tsx";
import { Shell } from "./Shell.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** The leader menu with the inbox turned off, and your two places after Uraeda's. */
const TOP: ReadonlyArray<MenuEntry> = [
  { icon: "search", key: "space", label: "Find anything…" },
  { icon: "uraeda:arrow-right", key: "c", label: "Continue" },
  { icon: DESTINATIONS.home.icon, key: "h", label: DESTINATIONS.home.label },
  { icon: DESTINATIONS.priorities.icon, key: "p", label: DESTINATIONS.priorities.label },
  { icon: DESTINATIONS.decisions.icon, key: "d", label: DESTINATIONS.decisions.label },
  { icon: DESTINATIONS.sessions.icon, key: "s", label: DESTINATIONS.sessions.label },
  { icon: "uraeda:globe", key: "y", label: "Deploy" },
  { icon: "uraeda:book-open", key: "w", label: "Wiki" },
  { icon: DESTINATIONS.settings.icon, key: ",", label: DESTINATIONS.settings.label },
  { icon: "uraeda:plus", isGroup: true, key: "n", label: "New" },
  { icon: "search", isGroup: true, key: "f", label: "Find" },
  { icon: "uraeda:palette", isGroup: true, key: "u", label: "UI" },
  { icon: "uraeda:layers", key: "r", label: "Switch repository…" },
];

/** A deployment as the Deploy place lists it. */
type Deployment = { age: string; branch: string; name: string; state: "failed" | "live" };

const DEPLOYMENTS: ReadonlyArray<Deployment> = [
  { age: "12 minutes ago", branch: "main", name: "Production", state: "live" },
  { age: "3 hours ago", branch: "change/2026-11-07-drag-handles", name: "Preview", state: "live" },
  { age: "yesterday", branch: "2026-11-05-code-editor", name: "Preview", state: "failed" },
];

/** The Deploy place, an extension's page drawn with the app's own components, in the shell. */
function DeployPlace() {
  return (
    <Shell>
      <VStack gap={3} xstyle={styles.page}>
        <Pane
          actions={<Button label="Refresh" size="sm" variant="secondary" />}
          icon="uraeda:globe"
          title="Deploy"
          titleSuffix="fetched 2 minutes ago"
        >
          <VStack as="ul" gap={2}>
            {DEPLOYMENTS.map((deployment) => (
              <HStack
                as="li"
                gap={3}
                justify="between"
                key={`${deployment.name}-${deployment.branch}`}
              >
                <VStack gap={1}>
                  <Text weight="semibold">{deployment.name}</Text>
                  <Text color="secondary" size="sm">
                    {deployment.branch}, {deployment.age}
                  </Text>
                </VStack>
                <Badge
                  label={deployment.state === "live" ? "Live" : "Failed"}
                  variant={deployment.state === "live" ? "success" : "error"}
                />
              </HStack>
            ))}
          </VStack>
        </Pane>
      </VStack>
    </Shell>
  );
}

/** The shell around the home, with the leader menu over it. */
function MenuOverHome() {
  return (
    <>
      <Shell>
        <Home />
      </Shell>
      <LeaderMenu entries={TOP} path={["Space"]} />
    </>
  );
}

const meta = {
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Extensions",
} satisfies Meta;

export default meta;

/** Space pressed: no Inbox, and your Deploy and Wiki places after Uraeda's. */
export const LeaderMenuWithYourPlaces: StoryObj = { render: () => <MenuOverHome /> };

/**
 * The Deploy place, `Space y`: one of your extensions, drawn like the rest of the app. The
 * navigation around it is the fixture's, which the mockup does not change.
 */
export const DeployPage: StoryObj = { render: () => <DeployPlace /> };
