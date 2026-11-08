// The extensions system's mockups (`specs/2026-11-08-extensions-system/spec.md`): the settings'
// Extensions section, Uraeda's own parts and yours, each with its switch; the same section with
// extensions that need you; the leader menu with the inbox turned off and two of your places in it;
// and a place one of your extensions draws, the "deploy" example, in the shell. Built from the real
// components over fixed text.
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { DESTINATIONS } from "./destinations.ts";
import { Home } from "./Home.tsx";
import { LeaderMenu, type MenuEntry } from "./keys/LeaderMenu.tsx";
import { Pane } from "./layout/Pane.tsx";
import { SettingRow, SettingRows } from "./settings/SettingRow.tsx";
import type { Setting } from "./settings/categories.ts";
import { Shell } from "./Shell.tsx";

const styles = stylex.create({
  page: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** An extension as the section lists it: its row, what the page says of it, and its switch. */
type Row = Pick<Setting, "help" | "icon" | "label"> & {
  isOn: boolean;
  notes?: ReactNode;
};

/** Uraeda's own parts, shipped as extensions: each can be turned off, none removed. */
const BUILT_IN: ReadonlyArray<Row> = [
  {
    help: "Runs your installed claude command in sessions.",
    icon: "uraeda:harness-claude",
    isOn: true,
    label: "Claude Code",
  },
  {
    help: "The Inbox place, its keys, its home pane, and its New-page section.",
    icon: "uraeda:inbox",
    isOn: false,
    label: "Inbox",
  },
  {
    help: "The Priorities place and starting a feature from a proposal.",
    icon: "uraeda:list",
    isOn: true,
    label: "Priorities and proposals",
  },
  {
    help: "The Decisions place and the decisions check.",
    icon: "uraeda:ruler",
    isOn: true,
    label: "Decisions",
  },
  { help: "The Git place.", icon: "uraeda:git-branch", isOn: true, label: "Git" },
  {
    help: "Storybook previews in specs and sessions.",
    icon: "uraeda:eye",
    isOn: true,
    label: "Previews",
  },
  {
    help: "Browser notifications when work needs you.",
    icon: "uraeda:flag",
    isOn: true,
    label: "Notifications",
  },
  {
    help: "Claude Code's five-hour and weekly usage.",
    icon: "uraeda:hourglass",
    isOn: true,
    label: "Usage window",
  },
];

/** Where an extension of yours comes from, under its help. */
function Source({ commit, from }: { commit?: string; from: string }) {
  return (
    <Text color="secondary" size="sm">
      {commit ? `${from} at ${commit}` : `Linked: ${from}, reloads on save`}
    </Text>
  );
}

/** Your extensions, in your config folder: two installed from git, one linked while you write it. */
const YOURS: ReadonlyArray<Row> = [
  {
    help: "Your production and preview deployments, from the hosting API, cached for 5 minutes.",
    icon: "uraeda:globe",
    isOn: true,
    label: "Deploy",
    notes: <Source from="~/code/uraeda-deploy" />,
  },
  {
    help: "Browse the repository's docs folder as a wiki.",
    icon: "uraeda:book-open",
    isOn: true,
    label: "Wiki",
    notes: <Source commit="3f9c2a1" from="github.com/gary/uraeda-wiki" />,
  },
  {
    help: "Runs pi-durable in sessions.",
    icon: "uraeda:harness-pi",
    isOn: false,
    label: "pi-durable",
    notes: <Source commit="b71e04d" from="github.com/gary/uraeda-pi" />,
  },
];

/** A row with its switch, which flips in place: the server applies it at once. */
function ExtensionRow({ row }: { row: Row }) {
  const [isOn, setOn] = useState(row.isOn);
  return (
    <SettingRow notes={row.notes} setting={row}>
      <Switch label="On" onChange={setOn} value={isOn} />
    </SettingRow>
  );
}

/** The settings' Extensions section: Uraeda's own first, then yours, or what needs you first. */
function Extensions({ needsYou, yours }: { needsYou?: ReactNode; yours: ReadonlyArray<Row> }) {
  return (
    <VStack gap={3} xstyle={styles.page}>
      {needsYou}
      <Pane icon="uraeda:plug" title="Your extensions">
        <SettingRows>
          {yours.map((row) => (
            <ExtensionRow key={row.label} row={row} />
          ))}
        </SettingRows>
      </Pane>
      <Pane icon="uraeda:layers" title="Built in">
        <SettingRows>
          {BUILT_IN.map((row) => (
            <ExtensionRow key={row.label} row={row} />
          ))}
        </SettingRows>
      </Pane>
    </VStack>
  );
}

/** Extensions that need you, each turned off alone, the others running. */
const NEEDS_YOU = (
  <VStack gap={2}>
    <Banner
      collapsible={false}
      status="error"
      title="Deploy is off: deploy/page.tsx, line 12: Expected '>' but found 'status'"
    />
    <Banner
      collapsible={false}
      endContent={<Button label="Update" size="sm" />}
      status="warning"
      title="pi-durable is off: built for extension API 1, and Uraeda runs API 2. Its sessions can be read, not continued."
    />
    <Banner
      collapsible={false}
      status="info"
      title="Claude Code reloads when the turn of “Fix the login redirect” ends."
    />
  </VStack>
);

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
  component: Extensions,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Extensions",
} satisfies Meta<typeof Extensions>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Settings, Extensions: your three, then Uraeda's own, the inbox turned off. */
export const Settings: Story = { args: { yours: YOURS } };

/** The same section when extensions need you: a compile error, an old API, a reload waiting. */
export const NeedsYou: Story = { args: { needsYou: NEEDS_YOU, yours: YOURS } };

/** Space pressed: no Inbox, and your Deploy and Wiki places after Uraeda's. */
export const LeaderMenuWithYourPlaces: StoryObj = { render: () => <MenuOverHome /> };

/**
 * The Deploy place, `Space y`: one of your extensions, drawn like the rest of the app. The
 * navigation around it is the fixture's, which the mockup does not change.
 */
export const DeployPage: StoryObj = { render: () => <DeployPlace /> };
