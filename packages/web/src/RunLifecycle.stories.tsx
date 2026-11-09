// The worker lifecycle's mockups (`specs/done/2026-11-03-worker-lifecycle.md`): a run waiting for a
// usage limit's reset, the lines a run continued by Uraeda leaves in its session, the run that
// reached the cap on automatic continues, home's panes with a waiting run and Continue all, and
// the Runs settings' new rows. Built from the real components over fixed text, with no server: the
// stories show the look, and the page's data is the real page's once built.
import { Button } from "@astryxdesign/core/Button";
import { ChatSystemMessage } from "@astryxdesign/core/Chat";
import { Icon } from "@astryxdesign/core/Icon";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { HomeRow } from "./home/parts.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { Pane } from "./layout/Pane.tsx";
import { pickedStyles } from "./layout/picked.ts";
import { SettingRow, SettingRows } from "./settings/SettingRow.tsx";
import { Ending } from "./TurnLines.tsx";

const styles = stylex.create({
  notice: {
    // As the transcript's system lines: left-aligned, not centred.
    justifyContent: "flex-start",
    textAlign: "start",
  },
  // A row Continue all leaves alone, while its button is under the pointer or focused.
  dimmed: {
    opacity: 0.4,
  },
  page: {
    maxWidth: "var(--size-reading-pane)",
  },
  // Rows fade in and out of the preview, never jump; at once with reduced motion.
  row: {
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "150ms" },
    transitionProperty: "opacity, background-color, box-shadow",
    transitionTimingFunction: "ease-out",
  },
});

/** A system line of the session, as the transcript draws one. */
function Line({ children }: { children: string }) {
  return <ChatSystemMessage xstyle={styles.notice}>{children}</ChatSystemMessage>;
}

/** The session's end while its run waits for a usage limit's reset, the banner above the composer. */
function Waiting() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Line>{"You've hit your session limit · resets 8:40am"}</Line>
      <AnnouncedBanner
        collapsible={false}
        description="The run continues by itself at 8:40. A message you send now goes to the agent at once, and Stop cancels the wait."
        status="info"
        title="Waiting for the usage limit's reset."
      />
    </VStack>
  );
}

/** The lines a run continued by Uraeda leaves in its session, one per reason. */
function Continued() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Ending state="stopped" text="Stopped: the server stopped while it ran." />
      <Line>Continued after the server restarted.</Line>
      <Line>{"You've hit your session limit · resets 8:40am"}</Line>
      <Line>{"Continued after the usage limit's reset."}</Line>
    </VStack>
  );
}

/** The run that stopped once more after the cap on automatic continues: it asks for the human. */
function CapReached() {
  return (
    <VStack gap={3} xstyle={styles.page}>
      <Line>{"Continued after the usage limit's reset."}</Line>
      <AnnouncedBanner
        collapsible={false}
        description="Uraeda continued it 3 times in a row without a commit or a message from you, and stops there. Read its last message, then tell it how to go on, or dismiss this."
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={() => {}}
        status="warning"
        title="The agent keeps stopping."
      />
    </VStack>
  );
}

/**
 * A row of home during Continue all's preview: tinted as a picked row when Continue all sends it a
 * message, dimmed when it leaves it alone; as usual outside the preview.
 */
function PreviewRow({
  children,
  isContinued,
  isPreviewing,
}: {
  children: ReactNode;
  isContinued: boolean;
  isPreviewing: boolean;
}) {
  return (
    <div
      {...stylex.props(
        styles.row,
        isPreviewing && (isContinued ? pickedStyles.picked : styles.dimmed),
      )}
    >
      {children}
    </div>
  );
}

/**
 * Home's Needs you, with Continue all in its border, and In progress with a waiting run. While
 * Continue all is under the pointer or focused, the runs it continues are tinted, and every other
 * row of home is dimmed; `isPreviewing` starts the story there.
 */
function HomePanes({ isPreviewing = false }: { isPreviewing?: boolean }) {
  const [previewing, setPreviewing] = useState(isPreviewing);
  const row = (isContinued: boolean, node: ReactNode) => (
    <PreviewRow isContinued={isContinued} isPreviewing={previewing}>
      {node}
    </PreviewRow>
  );
  return (
    <VStack gap={4} xstyle={styles.page}>
      <Pane
        actions={
          <span
            onBlur={() => setPreviewing(false)}
            onFocus={() => setPreviewing(true)}
            onPointerEnter={() => setPreviewing(true)}
            onPointerLeave={() => setPreviewing(false)}
          >
            <Button label="Continue all" size="sm" variant="secondary" />
          </span>
        }
        count={3}
        icon="uraeda:hourglass"
        title="Needs you"
        tone="attention"
      >
        {row(
          true,
          <HomeRow
            href="#"
            icon={<Icon icon="uraeda:step-plan" size="sm" />}
            status={{ label: "Failed", status: "attention" }}
            sub="Not logged in · Please run /login"
            title="Moving a file never breaks a link to it"
          />,
        )}
        {row(
          true,
          <HomeRow
            href="#"
            icon={<Icon icon="uraeda:step-implementation" size="sm" />}
            status={{ label: "Needs attention", status: "attention" }}
            sub="The server stopped the agent"
            title="Panes size"
          />,
        )}
        {row(
          false,
          <HomeRow
            action="Answer"
            href="#"
            icon={<Icon icon="uraeda:step-questions" size="sm" />}
            sub="6 questions"
            title="Vim in text edit mode"
          />,
        )}
      </Pane>
      <Pane count={2} icon="uraeda:activity" title="In progress">
        {row(
          false,
          <HomeRow
            href="#"
            icon={<Icon icon="uraeda:step-implementation" size="sm" />}
            status={{ label: "Waiting until 8:40", status: "working" }}
            sub="Task 4 of 9 · waiting for the usage limit, until 8:40"
            title="Worker lifecycle"
          />,
        )}
        {row(
          false,
          <HomeRow
            href="#"
            icon={<Icon icon="uraeda:step-spec" size="sm" />}
            status={{ label: "Working", status: "working" }}
            title="Master PR"
          />,
        )}
      </Pane>
    </VStack>
  );
}

/** A switch of the Runs section, on by default. */
function SwitchRow({ help, label }: { help: string; label: string }) {
  const [on, setOn] = useState(true);
  return (
    <SettingRow setting={{ help, icon: "uraeda:workflow", label }}>
      <Switch isLabelHidden label={label} onChange={setOn} value={on} />
    </SettingRow>
  );
}

/** The Runs section's new rows, under the one before them. */
function RunsSettings() {
  const [cap, setCap] = useState<number | null | undefined>(3);
  return (
    <VStack xstyle={styles.page}>
      <SettingRows>
        <SwitchRow
          help="A run the server stopped while it worked continues by itself when the server starts again, if it stopped less than 6 hours before."
          label="Continue after a restart"
        />
        <SwitchRow
          help="A run stopped by Claude Code's session limit continues by itself when the limit resets. Weekly limits still stop the run."
          label="Continue after a usage limit"
        />
        <SettingRow
          setting={{
            help: "How many times in a row Uraeda continues a run without a commit or a message from you. Past it, the run asks for you.",
            icon: "uraeda:history",
            label: "Automatic continues in a row",
          }}
        >
          <NumberInput
            isLabelHidden
            label="Automatic continues in a row"
            max={10}
            min={1}
            onChange={setCap}
            value={cap}
            width={80}
          />
        </SettingRow>
      </SettingRows>
      <Text color="secondary" type="supporting">
        A change applies at once: turning a continue off cancels the waits it started.
      </Text>
    </VStack>
  );
}

const meta = {
  // The stories fill the frame, as the session and home pages do.
  parameters: { layout: "padded" },
  title: "Run lifecycle",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** A run waiting for the usage limit's reset: the limit's line, then the banner saying when it goes on. */
export const WaitingForReset: Story = { render: () => <Waiting /> };

/** The line each automatic continue leaves: after a restart, after a limit's reset. */
export const ContinuedLines: Story = { render: () => <Continued /> };

/** The cap reached: the run asks for the human, with Dismiss. */
export const CapOnContinues: Story = { render: () => <CapReached /> };

/**
 * Home: Continue all in Needs you's border, and a waiting run in progress, its reset time on its
 * second line.
 */
export const Home: Story = { render: () => <HomePanes /> };

/**
 * Continue all under the pointer: the two stopped runs it continues tinted, the questions waiting
 * on you and the runs in progress dimmed.
 */
export const ContinueAllPreview: Story = { render: () => <HomePanes isPreviewing /> };

/** The Runs settings' new rows: two switches, on by default, and the cap. */
export const RunsSection: Story = { render: () => <RunsSettings /> };
