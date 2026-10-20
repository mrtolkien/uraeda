// Mockups of starting and growing a session once chats and changes merge
// (`specs/2026-10-20-merge-chats/spec.md`): the New page and its selector, then the agent's offer to
// make a session a change, or a change a feature, as a card in the session. Built from Astryx's
// components over fixed text, with no server: the stories show the look.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import {
  ChatComposer,
  ChatComposerInput,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
} from "@astryxdesign/core/Chat";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNavItem } from "@astryxdesign/core/SideNav";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Page } from "./layout/Page.tsx";

const styles = stylex.create({
  agent: { paddingInline: 0 },
  list: { paddingBlock: spacingVars["--spacing-1"] },
  surface: {
    backgroundColor: colorVars["--color-background-surface"],
    minHeight: "var(--size-viewport-height)",
  },
  user: { backgroundColor: colorVars["--color-background-blue"] },
});

type Kind = "change" | "feature" | "session";

const LINES = [
  { source: "Inbox", text: "The PR texts lack context: start with what was done" },
  { source: "Priorities", text: "CLI auto-expand in fish and zsh" },
  { source: "Priorities", text: "Empty inbox" },
];

/** The notes and priority lines a change or a feature can start from. */
function Lines({ action }: { action: string }) {
  return (
    <VStack gap={1} xstyle={styles.list}>
      <Text type="label">Or start from a note or a priority</Text>
      {LINES.map((line) => (
        <SideNavItem
          endContent={<Button label={action} size="sm" variant="secondary" />}
          href="#"
          key={line.text}
          label={`${line.source} · ${line.text}`}
        />
      ))}
    </VStack>
  );
}

/** The New page: the selector, then what the kind picked asks for. */
function NewPage({ kind: initial = "session" }: { kind?: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const [text, setText] = useState("");
  return (
    <div {...stylex.props(styles.surface)}>
      <Page>
        <VStack gap={4}>
          <Heading level={1}>New</Heading>
          <SegmentedControl
            label="What to start"
            onChange={(value: string) => setKind(value as Kind)}
            value={kind}
          >
            <SegmentedControlItem label="Session" value="session" />
            <SegmentedControlItem label="Change" value="change" />
            <SegmentedControlItem label="Feature" value="feature" />
          </SegmentedControl>
          {kind === "session" && (
            <Text color="secondary" type="supporting">
              Talk with the agent in the main checkout. It offers a change when the work grows.
            </Text>
          )}
          {kind !== "feature" && (
            <ChatComposer
              input={<ChatComposerInput label="Message Claude Code" maxRows={9} />}
              onChange={setText}
              onSubmit={() => setText("")}
              placeholder={
                kind === "change"
                  ? "Describe the bug or the change. The first line is its title."
                  : "Message Claude Code"
              }
              sendLabel={kind === "change" ? "Start the change" : "Send"}
              value={text}
            />
          )}
          {kind === "change" && (
            <>
              <TextInput label="Slug" value="login-redirect" />
              <Lines action="Start the change" />
            </>
          )}
          {kind === "feature" && (
            <>
              <HStack align="end" gap={2}>
                <TextInput label="Title" value="" />
                <Button label="Write the proposal" />
              </HStack>
              <Lines action="Open the draft" />
            </>
          )}
        </VStack>
      </Page>
    </div>
  );
}

const PROPOSAL = `# Login redirects twice

The login page redirects to \`/home\`, then to \`/\`, after signing in.`;

/** The agent's offer, as the session draws it: the proposal to edit, its slug, and the button. */
function Offer({ kind }: { kind: "change" | "feature" }) {
  const [proposal, setProposal] = useState(PROPOSAL);
  return kind === "change" ? (
    <Card>
      <VStack gap={3}>
        <Heading level={3}>Start a change</Heading>
        <TextArea label="Proposal" onChange={setProposal} rows={5} value={proposal} />
        <TextInput label="Slug" value="login-redirect" />
        <Text color="secondary" type="supporting">
          This session goes on in the change’s worktree, on change/2026-10-20-login-redirect. The
          files it edited move there too.
        </Text>
        <HStack gap={2}>
          <Button label="Start the change" variant="primary" />
          <Button label="Not now" variant="ghost" />
        </HStack>
      </VStack>
    </Card>
  ) : (
    <Card>
      <VStack gap={3}>
        <Heading level={3}>Make this change a feature</Heading>
        <Text>
          It changes the format of PRIORITIES.md, which every project has: the spec should be
          approved first.
        </Text>
        <Text color="secondary" type="supporting">
          Same branch and session, without change/, and its discovery starts next.
        </Text>
        <HStack gap={2}>
          <Button label="Make it a feature" variant="primary" />
          <Button label="Keep it a change" variant="ghost" />
        </HStack>
      </VStack>
    </Card>
  );
}

/** A session, its header's upgrade button, and the agent's offer at its end. */
function Growing({
  fresh = false,
  kind = "change",
  started = false,
}: {
  fresh?: boolean;
  kind?: "change" | "feature";
  started?: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <div {...stylex.props(styles.surface)}>
      <Page isSnug>
        <VStack gap={3}>
          <HStack align="center" gap={2} justify="space-between">
            <VStack gap={1}>
              <Heading level={1}>
                {kind === "change" ? "Why does the login redirect twice?" : "Priorities sections"}
              </Heading>
              <Text color="secondary" type="supporting">
                {kind === "change" ? "Idle · Claude Code · main" : "Idle · Claude Code · change"}
              </Text>
            </VStack>
            <Button
              label={kind === "change" ? "Make it a change" : "Make it a feature"}
              size="sm"
              variant="secondary"
            />
          </HStack>
          <ChatMessageList align="top" aria-label="Conversation" density="compact">
            <ChatMessage sender="user">
              <ChatMessageBubble xstyle={styles.user}>
                {kind === "change"
                  ? "Why does the login redirect twice? Fix it."
                  : "Add a Blocked reason column to the priorities."}
              </ChatMessageBubble>
            </ChatMessage>
            <ChatMessage sender="assistant">
              <ChatMessageBubble variant="ghost" width="100%" xstyle={styles.agent}>
                <Text>
                  {kind === "change"
                    ? "The session guard and the router both redirect. The fix needs a test through the real login: it should not land on main directly."
                    : "A column changes the format of `PRIORITIES.md` in every project."}
                </Text>
              </ChatMessageBubble>
            </ChatMessage>
            {started ? (
              <Banner
                collapsible={false}
                status="info"
                title="Started as the change Login redirects twice, on change/2026-10-20-login-redirect"
              />
            ) : (
              <Offer kind={kind} />
            )}
          </ChatMessageList>
          <ChatComposer
            footerActions={
              kind === "feature" ? (
                <Switch label="In a new session" onChange={() => {}} value={fresh} />
              ) : undefined
            }
            input={<ChatComposerInput label="Message Claude Code" maxRows={9} />}
            onChange={setText}
            onSubmit={() => setText("")}
            placeholder="Message Claude Code"
            value={text}
          />
        </VStack>
      </Page>
    </div>
  );
}

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Mockups/New and growing sessions",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** "＋ New", with Session picked: the composer only. */
export const NewSessionPage: Story = { render: () => <NewPage /> };

/** "＋ New", with Change picked: the composer, the slug, and the notes and priorities to start from. */
export const NewChangePage: Story = { render: () => <NewPage kind="change" /> };

/** "＋ New", with Feature picked: a title for a new proposal, or a note or a priority to draft. */
export const NewFeaturePage: Story = { render: () => <NewPage kind="feature" /> };

/** The agent offers a change: its proposal and slug, editable, then "Start the change". */
export const ChangeOffer: Story = { render: () => <Growing /> };

/** Once started: the session says so, and goes on in the change's worktree. */
export const ChangeStarted: Story = { render: () => <Growing started /> };

/**
 * In a change's session, the agent offers to make it a feature, with its reason. Under the composer,
 * "In a new session" sends the next message to a new agent session, in the same worktree.
 */
export const FeatureOffer: Story = { render: () => <Growing kind="feature" /> };

/** "In a new session" on: the next message starts a new agent session, whatever the step. */
export const NewSessionOn: Story = { render: () => <Growing fresh kind="feature" /> };
