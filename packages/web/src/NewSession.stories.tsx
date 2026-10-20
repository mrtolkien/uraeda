// Mockups of starting and growing a session once chats and changes merge
// (`specs/2026-10-20-merge-chats/spec.md`): the New page and its selector; a session's actions, in a
// "…" beside its composer, and the agent's offer to make it a change, or a change a feature; then the
// sessions a change's or a feature's page lists, with "New session". Built from Astryx's components
// over fixed text, with no server: the stories show the look.
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
import { Icon } from "@astryxdesign/core/Icon";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNavItem } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { Page } from "./layout/Page.tsx";
import { StatusMark } from "./StatusMark.tsx";

const styles = stylex.create({
  agent: { paddingInline: 0 },
  list: { paddingBlock: spacingVars["--spacing-1"] },
  subagent: { paddingInlineStart: spacingVars["--spacing-6"] },
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

/** What each kind is, and the steps that wait on the human, in order. */
const ABOUT: Record<Kind, { steps: Array<{ icon: string; label: string }>; text: string }> = {
  change: {
    steps: [
      { icon: "uraeda:step-proposal", label: "Prompt" },
      { icon: "uraeda:step-questions", label: "Questions, if any" },
      { icon: "uraeda:step-pull-request", label: "Pull request" },
    ],
    text: "A bug fix or a small change, on its own branch. The agent asks only what it must, then opens a pull request.",
  },
  feature: {
    steps: [
      { icon: "uraeda:step-proposal", label: "Prompt" },
      { icon: "uraeda:step-questions", label: "Questions" },
      { icon: "uraeda:step-spec", label: "Spec" },
      { icon: "uraeda:step-pull-request", label: "Pull request" },
    ],
    text: "A larger piece of work, on its own branch. You answer its questions and approve its spec before any code.",
  },
  session: {
    steps: [],
    text: "A conversation with the agent, in the main checkout, like plain Claude Code. It offers a change when the work grows.",
  },
};

/** The kind's explanation, and its steps as a line of icons and arrows. */
function About({ kind }: { kind: Kind }) {
  const { steps, text } = ABOUT[kind];
  return (
    <VStack gap={2}>
      <Text color="secondary">{text}</Text>
      {steps.length > 0 && (
        <HStack align="center" gap={2} wrap="wrap">
          {steps.map((step, index) => (
            <HStack align="center" gap={1} key={step.label}>
              {index > 0 && (
                <Text aria-hidden color="secondary">
                  →
                </Text>
              )}
              <Icon color="secondary" icon={step.icon} size="sm" />
              <Text type="supporting">{step.label}</Text>
            </HStack>
          ))}
        </HStack>
      )}
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
          <About kind={kind} />
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

type Stage = "change" | "change-offer" | "drop" | "feature-offer" | "session";

/**
 * A session's page. Its actions sit in the "…" beside the composer's Send, where they stay in reach
 * however long the session: making it a change, or its change a feature, renaming, and archiving.
 */
function Growing({ menu = false, stage = "change-offer" }: { menu?: boolean; stage?: Stage }) {
  const [text, setText] = useState("");
  const isChange = stage === "change" || stage === "drop" || stage === "feature-offer";
  const title =
    stage === "feature-offer" ? "priorities-sections" : "Why does the login redirect twice?";
  const actions = [
    isChange
      ? { label: "Make it a feature", onClick: () => {} }
      : { label: "Make it a change", onClick: () => {} },
    { label: "Rename", onClick: () => {} },
    isChange
      ? { label: "Drop the change…", onClick: () => {} }
      : { label: "Archive", onClick: () => {} },
  ];
  return (
    <div {...stylex.props(styles.surface)}>
      <Page isSnug>
        <VStack gap={3}>
          <VStack gap={1}>
            <Heading level={1}>{title}</Heading>
            <HStack align="center" gap={2}>
              <Icon color="secondary" icon={isChange ? "wrench" : "uraeda:comment"} size="sm" />
              <Text color="secondary" type="supporting">
                {isChange
                  ? "Change · Idle · Claude Code · change/2026-10-20-login-redirect"
                  : "Session · Idle · Claude Code · main"}
              </Text>
            </HStack>
          </VStack>
          <ChatMessageList align="top" aria-label="Conversation" density="compact">
            <ChatMessage sender="user">
              <ChatMessageBubble xstyle={styles.user}>
                {stage === "feature-offer"
                  ? "Add a Blocked reason column to the priorities."
                  : "Why does the login redirect twice? Fix it."}
              </ChatMessageBubble>
            </ChatMessage>
            <ChatMessage sender="assistant">
              <ChatMessageBubble variant="ghost" width="100%" xstyle={styles.agent}>
                <Text>
                  {stage === "feature-offer"
                    ? "A column changes the format of PRIORITIES.md in every project."
                    : "The session guard and the router both redirect. The fix needs a test through the real login: it should not land on main directly."}
                </Text>
              </ChatMessageBubble>
            </ChatMessage>
            {stage === "change-offer" && <Offer kind="change" />}
            {stage === "feature-offer" && <Offer kind="feature" />}
            {(stage === "change" || stage === "drop") && (
              <Banner
                collapsible={false}
                status="info"
                title="Started as the change Login redirects twice, on change/2026-10-20-login-redirect"
              />
            )}
          </ChatMessageList>
          {stage === "drop" && <DropDialog />}
          <ChatComposer
            input={<ChatComposerInput label="Message Claude Code" maxRows={9} />}
            onChange={setText}
            onSubmit={() => setText("")}
            placeholder="Message Claude Code"
            sendActions={
              <MoreMenu
                isMenuOpen={menu || undefined}
                items={actions}
                label="Session actions"
                size="sm"
              />
            }
            value={text}
          />
        </VStack>
      </Page>
    </div>
  );
}

/**
 * "Drop the change…", confirmed: as the app's confirmations read, a dialog on a desktop and a sheet
 * on a phone. The branch stays, since tools never delete a branch the default branch lacks.
 */
function DropDialog() {
  return (
    <Card>
      <VStack gap={3}>
        <Heading level={3}>Drop the change login-redirect?</Heading>
        <Text>
          Its entry leaves Now, its worktree is removed, and its sessions are archived. Its branch
          stays, so nothing is lost: git branch -D change/2026-10-20-login-redirect deletes it.
        </Text>
        <HStack gap={2} justify="end">
          <Button label="Keep the change" variant="ghost" />
          <Button label="Drop the change" variant="destructive" />
        </HStack>
      </VStack>
    </Card>
  );
}

/** A session attached to a change or a feature, as its page lists it. */
type Attached = {
  started: string;
  status: "idle" | "working";
  subagents: Array<string>;
  title: string;
};

const ATTACHED: Array<Attached> = [
  {
    started: "Started 2026-10-20 09:12",
    status: "working",
    subagents: ["Write the card's tests", "Map the theme's tokens"],
    title: "Build: tasks 4 to 7",
  },
  { started: "Started 2026-10-19 16:40", status: "idle", subagents: [], title: "Spec and plan" },
];

/** The sessions card of a change's or a feature's page, beside "Next", newest first. */
function Sessions() {
  return (
    <div {...stylex.props(styles.surface)}>
      <Page>
        <Card>
          <VStack gap={3}>
            <HStack align="center" justify="between">
              <Heading level={3}>Sessions</Heading>
              <Button label="New session" variant="secondary" />
            </HStack>
            {ATTACHED.map((session) => (
              <VStack gap={1} key={session.title}>
                <SideNavItem
                  endContent={
                    <Text color="secondary" type="supporting">
                      {session.started}
                    </Text>
                  }
                  href="#"
                  icon={
                    <StatusMark
                      label={session.status === "working" ? "Working" : "Idle"}
                      status={session.status}
                    />
                  }
                  label={session.title}
                />
                {session.subagents.map((subagent) => (
                  <HStack align="center" gap={2} key={subagent} xstyle={styles.subagent}>
                    <StatusMark label="Working" small status="working" />
                    <Text color="secondary" maxLines={1} type="supporting">
                      {subagent}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            ))}
          </VStack>
        </Card>
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

/** A session's actions, open beside Send: make it a change, rename, archive. */
export const SessionActions: Story = { render: () => <Growing menu stage="session" /> };

/** Once started: the session says so, and its actions offer a feature, and dropping the change. */
export const ChangeStarted: Story = { render: () => <Growing menu stage="change" /> };

/** "Drop the change…" picked in the change's actions: what goes, and what stays. */
export const DropChange: Story = { render: () => <Growing stage="drop" /> };

/** In a change's session, the agent offers to make it a feature, with its reason. */
export const FeatureOffer: Story = { render: () => <Growing stage="feature-offer" /> };

/**
 * A feature's sessions, on its page: the working one first with its sub-agents, then the earlier
 * one, and "New session", which opens a new session in the feature's worktree, on its own page.
 */
export const FeatureSessions: Story = { render: () => <Sessions /> };
