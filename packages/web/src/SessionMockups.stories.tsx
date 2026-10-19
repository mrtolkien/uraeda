// The session page of the session redesign (`specs/done/2026-10-19-redesign-session.md`), as a
// phone reads it: the human's messages in a tinted bubble, the agent's as flat text across the page,
// a 3-row composer, and the bar of actions above it. Built from Astryx's chat components over fixed
// text, with no server: the stories show the look, and the page's data is the real page's.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerInput,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
  ChatToolCalls,
} from "@astryxdesign/core/Chat";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Markdown } from "@astryxdesign/core/Markdown";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Page } from "./layout/Page.tsx";

const styles = stylex.create({
  agent: {
    // The agent's text takes the page's width: no bubble, no padding of its own.
    paddingInline: 0,
  },
  composer: {
    backgroundColor: colorVars["--color-background-surface"],
    bottom: 0,
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
  },
  input: {
    // 3 rows empty, 22 px each.
    minHeight: "var(--size-composer-input-narrow)",
  },
  jump: {
    // Centred above the composer, over the transcript's end, without moving it.
    bottom: "100%",
    display: "flex",
    insetInline: 0,
    justifyContent: "center",
    paddingBlockEnd: spacingVars["--spacing-2"],
    position: "absolute",
  },
  jumpButton: {
    // The secondary button's fill is translucent: the surface under it keeps the text from showing.
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-element"],
    display: "inline-flex",
  },
  list: {
    // The list's own 8 px inset is taken back: the page's inset is the only one, so the agent's
    // text takes the width the phone has.
    marginInline: "var(--page-bleed)",
  },
  surface: {
    // The app's shell paints the page's surface: the story does the same.
    backgroundColor: colorVars["--color-background-surface"],
    minHeight: "var(--size-viewport-height)",
  },
  user: {
    backgroundColor: colorVars["--color-background-blue"],
  },
});

const REPLY = `The recurring-task store keeps one row per task, so completing a task moves its due date.

- \`src/store/tasks.ts\` owns the move.
- The undo puts the previous date back.

I ran the tests and **all 41 pass**.`;

/** A message of the human's: a tinted bubble on the right. */
function Human({ children }: { children: string }) {
  return (
    <ChatMessage sender="user">
      <ChatMessageBubble xstyle={styles.user}>{children}</ChatMessageBubble>
    </ChatMessage>
  );
}

/** A message of the agent's: flat text across the page. */
function Agent({ children }: { children: string }) {
  return (
    <ChatMessage sender="assistant">
      <ChatMessageBubble variant="ghost" width="100%" xstyle={styles.agent}>
        <Markdown autolink="gfm" density="compact" headingLevelStart={4}>
          {children}
        </Markdown>
      </ChatMessageBubble>
    </ChatMessage>
  );
}

const CALLS = [
  { key: "1", name: "Read", status: "complete", target: "src/store/tasks.ts" },
  { key: "2", name: "Edit", status: "complete", target: "src/store/tasks.ts" },
  { key: "3", name: "Bash", status: "complete", target: "pnpm test" },
] as const;

/** A blocked action, as the transcript shows it, with its own button. */
function Blocked({ action }: { action: string }) {
  return (
    <Banner
      collapsible={false}
      endContent={<Button label="Allow and retry" size="sm" />}
      status="warning"
      title={`Blocked by auto mode: ${action}`}
    />
  );
}

/** The page, as a phone draws it: `blocked` actions wait, and `earlier` messages can be loaded. */
function Session({
  blocked = [],
  earlier = true,
  scrolled = false,
}: {
  blocked?: Array<string>;
  earlier?: boolean;
  scrolled?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div {...stylex.props(styles.surface)}>
      <Page isSnug>
        <VStack gap={3}>
          <VStack gap={1}>
            <Heading level={1}>Recurring tasks</Heading>
            <Text color="secondary" type="supporting">
              Needs you · Claude Code · main
            </Text>
          </VStack>
          {earlier && <Button label="Show earlier messages" variant="secondary" />}
          <ChatMessageList
            align="top"
            aria-label="Conversation"
            density="compact"
            xstyle={styles.list}
          >
            <Human>Make completing a repeating task move its due date, and keep the undo.</Human>
            <ChatMessage sender="assistant">
              <ChatToolCalls calls={[...CALLS]} label="3 tool calls" />
            </ChatMessage>
            <Agent>{REPLY}</Agent>
            {blocked.map((action) => (
              <Blocked action={action} key={action} />
            ))}
          </ChatMessageList>
          <div {...stylex.props(styles.composer)}>
            {scrolled && (
              <div {...stylex.props(styles.jump)}>
                <span {...stylex.props(styles.jumpButton)}>
                  <Button label="Jump to the latest" size="sm" variant="secondary" />
                </span>
              </div>
            )}
            <ChatComposer
              footerActions={
                <HStack align="center" gap={2}>
                  <Button label="Archive" size="sm" variant="ghost" />
                </HStack>
              }
              input={
                <ChatComposerInput label="Message Claude Code" maxRows={9} xstyle={styles.input} />
              }
              onChange={setText}
              onSubmit={() => setText("")}
              placeholder="Message Claude Code"
              sendActions={
                blocked.length > 1 ? <Button label={`Allow all (${blocked.length})`} /> : undefined
              }
              value={text}
            />
          </div>
        </VStack>
      </Page>
    </div>
  );
}

const meta = {
  component: Session,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Session",
} satisfies Meta<typeof Session>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Reading: the human's message in a tinted bubble, the agent's as flat text across an 8 px inset,
 * the tool calls in one line, and a 3-row composer with Archive in its footer. "Show earlier
 * messages" opens the list, as the session holds more.
 */
export const Reading: Story = {};

/** Two actions blocked: "Allow all (2)" sits beside Send, and each action has its own button. */
export const Blocking: Story = {
  args: { blocked: ["Bash rm -rf dist", "Edit src/store/tasks.ts"], earlier: false },
};

/** Reading above the end: "Jump to the latest" floats, centred, above the composer. */
export const Scrolled: Story = { args: { earlier: false, scrolled: true } };
