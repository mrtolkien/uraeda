// The catch-up's mockups (`specs/2026-11-08-agents-fix/spec.md`): a feature whose open pull request
// is behind main, its card while nobody catches it up, while its agent does, and once it stopped on
// a conflict; the lines and the banner the catch-up leaves in its session; and the Runs settings'
// new switch, off by default. Built from the real components over fixed text, with no server: the
// stories show the look, and the page's data is the real page's once built.
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { SettingRow, SettingRows } from "./settings/SettingRow.tsx";
import { columnVars } from "./shell/column.stylex.ts";
import { type CardItem, ItemCard } from "./sidebar/ItemCard.tsx";

const styles = stylex.create({
  column: { maxWidth: columnVars["--column-phone-max"], padding: spacingVars["--spacing-3"] },
  notice: {
    // As the transcript's system lines: left-aligned, not centred.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  page: {
    maxWidth: "var(--size-reading-pane)",
  },
});

const open = () => {};

/** The fixed feature every card draws: "Run options", with its pull request #116. */
const RUN_OPTIONS: CardItem = {
  folder: "2026-11-08-run-options",
  harness: "claude",
  kind: "feature",
  label: "Run options",
  pullRequest: { number: 116, url: "https://github.com/mrtolkien/uraeda/pull/116" },
  status: { label: "Idle", status: "idle" },
  step: { kind: "pull-request", label: "Catch up" },
  title: "Run options",
};

/** A pane's title, then one card, as the sidebar draws it. */
function Pane({ card, title }: { card: CardItem; title: string }) {
  return (
    <VStack gap={1} xstyle={styles.column}>
      <Text color="secondary" type="supporting">
        {title}
      </Text>
      <ItemCard
        href="#"
        item={card}
        onDismiss={card.status.status === "attention" ? open : undefined}
        onOpen={open}
        onStatus={open}
      />
    </VStack>
  );
}

/** A system line of the session, as the transcript draws one. */
function Line({ children }: { children: string }) {
  return <ChatSystemMessage xstyle={styles.notice}>{children}</ChatSystemMessage>;
}

/** The line a catch-up opens with, then the banner of one that stopped on a conflict. */
function Session() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Line>
        {
          "Catching up with main, which moved to “finish(codex-runtime): Codex runtime + model settings”."
        }
      </Line>
      <AnnouncedBanner
        collapsible={false}
        description="It left the branch as it was, and asked on pull request #116 how to settle a conflict. Answer there by requesting changes, or dismiss this."
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={open}
        status="warning"
        title="The catch-up stopped on a conflict."
      />
    </VStack>
  );
}

const CATCH_UP = "Catch up open pull requests";

/** The Runs section's new switch, off by default, under the automatic continues. */
function RunsSettings() {
  const [on, setOn] = useState(false);
  return (
    <VStack xstyle={styles.page}>
      <SettingRows>
        <SettingRow
          setting={{
            help: "When main gains code, decisions, or records, each pull request ready for your review is rebased on it by its agent, checked, and pushed again. A conflict that needs your choice stops it, with a comment on the pull request. A change applies at once.",
            icon: "uraeda:workflow",
            label: CATCH_UP,
          }}
        >
          <Switch isLabelHidden label={CATCH_UP} onChange={setOn} value={on} />
        </SettingRow>
      </SettingRows>
    </VStack>
  );
}

const meta = {
  // The stories fill the frame, as the sidebar and the session do.
  parameters: { layout: "padded" },
  title: "Mockups/Catch up",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Main gained code since the pull request was opened, and nothing runs: the agent's step, Catch up. */
export const BehindMain: Story = {
  render: () => <Pane card={RUN_OPTIONS} title="In progress" />,
};

/** The switch is on: the agent catches the pull request up. */
export const CatchingUp: Story = {
  render: () => (
    <Pane
      card={{ ...RUN_OPTIONS, status: { label: "Working", status: "working" } }}
      title="In progress"
    />
  ),
};

/** The catch-up stopped on a conflict that needs your choice: it asks for you until dismissed. */
export const Stopped: Story = {
  render: () => (
    <Pane
      card={{ ...RUN_OPTIONS, status: { label: "Needs attention", status: "attention" } }}
      title="Needs you"
    />
  ),
};

/** The session: the line saying why the catch-up started, then the banner of one that stopped. */
export const SessionLines: Story = { render: () => <Session /> };

/** The Runs settings' new switch, off by default. */
export const RunsSection: Story = { render: () => <RunsSettings /> };
