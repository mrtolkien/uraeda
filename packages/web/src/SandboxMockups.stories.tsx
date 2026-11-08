// Mockups of agent sandboxes (`specs/proposals/nix-docker/spec.md`): the Sandboxes section of the
// settings, a feature's first start in a sandbox, a session's sandbox mark and a blocked host, a
// session refused without its sandbox, a feature started before sandboxing, and a chat's choice.
// Built from Astryx and the app's own rows over fixed text, with no server: the stories show the
// look, and the spec's text stays the reference for behaviour.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatMessage,
  ChatMessageBubble,
  ChatMessageList,
} from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Heading } from "@astryxdesign/core/Heading";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { Page } from "./layout/Page.tsx";
import { StartStepsView } from "./session/StartSteps.tsx";
import { SettingRow, SettingRows } from "./settings/SettingRow.tsx";

const styles = stylex.create({
  agent: { paddingInline: 0 },
  surface: {
    backgroundColor: colorVars["--color-background-surface"],
    minHeight: "var(--size-viewport-height)",
  },
  user: { backgroundColor: "var(--role-yours-tint)" },
});

/** The page's surface, as the app's shell paints it. */
function Surface({ children, kind }: { children: ReactNode; kind: "session" | "settings" }) {
  return (
    <div {...stylex.props(styles.surface)}>
      <Page isSnug={kind === "session"} kind={kind === "session" ? "session" : "rows"}>
        {children}
      </Page>
    </div>
  );
}

const LOGIN_CLAUDE = "sbx run --rm --name uraeda-login claude";
const LOGIN_GITHUB = "sbx secret set -g github";

/** A command to run in a terminal, with its copy button. */
function Command({ code }: { code: string }) {
  return (
    <VStack align="start" gap={2}>
      <CodeBlock code={code} hasCopyButton={false} isWrapped size="sm" width="100%" />
      <Button
        label="Copy"
        onClick={() => void navigator.clipboard?.writeText(code)}
        size="sm"
        variant="secondary"
      />
    </VStack>
  );
}

/** The Sandboxes section: the tool's state, the logins, and one switch per repository. */
function Settings({ problem }: { problem?: string }) {
  const [sandboxed, setSandboxed] = useState({ "todo-app": false, uraeda: true });
  return (
    <Surface kind="settings">
      <VStack gap={3}>
        <Heading level={2}>Sandboxes</Heading>
        {problem && <Banner collapsible={false} status="error" title={problem} />}
        <SettingRows>
          <SettingRow
            notes={
              !problem && (
                <Text color="secondary" type="supporting">
                  sbx 0.51.0 · signed in to Docker
                </Text>
              )
            }
            setting={{
              help: "Agents of a sandboxed repository run in a Docker Sandboxes microVM, one per feature or change, with only its checkout.",
              icon: "uraeda:shield",
              label: "Docker Sandboxes",
            }}
          />
          <SettingRow
            notes={
              <VStack gap={2}>
                <Command code={LOGIN_CLAUDE} />
                <Command code={LOGIN_GITHUB} />
              </VStack>
            }
            setting={{
              help: "Run these once in a terminal: sign in to Claude Code with /login, then give a GitHub token, ideally scoped to your repositories. Docker Sandboxes keeps both outside the sandboxes.",
              icon: "uraeda:key-round",
              label: "Logins",
            }}
          />
          {(["uraeda", "todo-app"] as const).map((name) => (
            <SettingRow
              key={name}
              setting={{
                help: "Its agents, previews, and commits run in sandboxes. A change applies to the next session.",
                icon: "uraeda:git-branch",
                label: name,
              }}
            >
              <Switch
                isDisabled={problem !== undefined}
                isLabelHidden
                label={`Sandbox ${name}`}
                onChange={(on: boolean) => setSandboxed({ ...sandboxed, [name]: on })}
                value={sandboxed[name]}
              />
            </SettingRow>
          ))}
        </SettingRows>
      </VStack>
    </Surface>
  );
}

const REPLY = "I compared Vite's documented options with the repository's vite.config.ts.";

/** A session's page, as a phone draws it: its header, a short exchange, `notice`, and the composer. */
function Session({
  composerStart,
  meta = "Working · Claude Code · Sandboxed",
  notice,
  title = "Dark mode",
}: {
  composerStart?: ReactNode;
  meta?: string;
  notice?: ReactNode;
  title?: string;
}) {
  const [text, setText] = useState("");
  return (
    <Surface kind="session">
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={1}>{title}</Heading>
          <Text color="secondary" type="supporting">
            {meta}
          </Text>
        </VStack>
        <ChatMessageList align="top" aria-label="Conversation" density="compact">
          <ChatMessage sender="user">
            <ChatMessageBubble xstyle={styles.user}>
              Investigate the feature and ask me your questions.
            </ChatMessageBubble>
          </ChatMessage>
          <ChatMessage sender="assistant">
            <ChatMessageBubble variant="ghost" width="100%" xstyle={styles.agent}>
              <Text>{REPLY}</Text>
            </ChatMessageBubble>
          </ChatMessage>
        </ChatMessageList>
        {notice}
        <ChatComposer
          footerActions={composerStart}
          onChange={setText}
          onSubmit={() => setText("")}
          placeholder="Message Claude Code"
          value={text}
        />
      </VStack>
    </Surface>
  );
}

const STEPS_TITLE = "Starting the feature Dark mode";
const CLONE = "Make the branch 2026-11-08-dark-mode and its clone";
const ENVIRONMENT = "Build the environment from flake.lock: the first time takes a few minutes";
const SANDBOX = "Start its sandbox";
const AGENT = "Start the agent with your message";

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Mockups/Sandboxes",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Settings: Docker Sandboxes ready, the two logins to run once, and uraeda sandboxed. */
export const SettingsReady: Story = { render: () => <Settings /> };

/** Settings: Docker Sandboxes cannot start a sandbox here, so no repository can turn it on. */
export const SettingsUnavailable: Story = {
  render: () => (
    <Settings problem="Docker Sandboxes cannot start a sandbox on this machine: virtualization is off in its firmware (SVM disabled by BIOS)." />
  ),
};

/** A feature's first start in a sandboxed repository: its environment builds once per lock. */
export const FirstStart: Story = {
  render: () => (
    <Surface kind="session">
      <StartStepsView
        onProposal={() => {}}
        steps={[
          { label: CLONE, seconds: 1, state: "done" },
          {
            label: ENVIRONMENT,
            output:
              "copying path '/nix/store/…-rust-default-1.96.0' from 'https://cache.nixos.org'…",
            seconds: 74,
            state: "running",
          },
          { label: SANDBOX, state: "waiting" },
          { label: AGENT, state: "waiting" },
        ]}
        title={STEPS_TITLE}
      />
    </Surface>
  ),
};

/** The sandbox blocked a host the agent asked for: one press allows it in every sandbox. */
export const BlockedHost: Story = {
  render: () => (
    <Session
      notice={
        <Banner
          collapsible={false}
          description={
            <VStack align="start" gap={2}>
              <Text>Allowing it opens vite.dev to every sandbox on this machine.</Text>
              <Button label="Allow and retry" size="sm" />
            </VStack>
          }
          status="warning"
          title="Blocked by the sandbox: vite.dev"
        />
      }
    />
  ),
};

/** A sandboxed repository's session that cannot start its sandbox: it never runs outside it. */
export const Refused: Story = {
  render: () => (
    <Session
      meta="Failed · Claude Code · Sandboxed"
      notice={
        <Banner
          collapsible={false}
          description="This repository runs its agents in sandboxes, so the session did not start outside one."
          status="error"
          title="Docker Sandboxes cannot start a sandbox on this machine: virtualization is off in its firmware (SVM disabled by BIOS)."
        />
      }
    />
  ),
};

/** A feature started before sandboxing: its worktree moves to a clone when the human asks. */
export const MoveToSandbox: Story = {
  render: () => (
    <Session
      meta="Needs you · Claude Code"
      notice={
        <Banner
          collapsible={false}
          description={
            <VStack align="start" gap={2}>
              <Text>
                This feature’s worktree shares the repository’s git folder, so its agent cannot run
                in a sandbox. Moving it makes a clone of its branch and removes the worktree.
              </Text>
              <Button label="Move to a sandbox" size="sm" />
            </VStack>
          }
          status="info"
          title="This feature started before its repository ran agents in sandboxes."
        />
      }
      title="Recurring tasks"
    />
  ),
};

/** A new chat on the main checkout: sandboxed only when the human turns it on. */
function NewChat() {
  const [sandboxed, setSandboxed] = useState(false);
  return (
    <Session
      composerStart={
        <Switch label="Sandboxed" onChange={setSandboxed} size="sm" value={sandboxed} />
      }
      meta="New chat · Claude Code · main"
      title="New chat"
    />
  );
}

/** A new chat: the Sandboxed switch sits in the composer's footer, off until turned on. */
export const NewChatChoice: Story = { render: () => <NewChat /> };
