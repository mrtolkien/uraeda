import { Button } from "@astryxdesign/core/Button";
import { ChatSendButton } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { ComposerProps } from "./Composer.tsx";
import { type Inserted, RecommendedMessage } from "./RecommendedMessage.tsx";

const styles = stylex.create({
  // Square, as the terminal look's other buttons are: Astryx draws its send button round.
  square: { borderRadius: 0 },
});

/** The send key drawn in the button, beside its label: Ctrl and the Enter key. */
function SendKeys() {
  return (
    <HStack align="center" aria-hidden="true" gap={1}>
      <span>Ctrl</span>
      <Icon icon="uraeda:enter" label="Enter" />
    </HStack>
  );
}

/**
 * The composer's send buttons, in its send row: Send, or "Start the agent" while it holds the
 * workflow's message, "Start once this turn ends" during a turn, or the page's own `label`. During
 * a chat's turn, Send steers the message into it, beside Stop: shown, disabled, while its images
 * are saved. While `onSend` is `pending`, the page's button is busy, its spinner shown. From two
 * blocked actions `allow`'d at once, "Allow all (N)" shows beside them, disabled while the session
 * works, since allowing reopens its process. The session's `actions`, its "…", come first.
 */
export function sendButtons({
  actions,
  allow,
  canSend,
  hasContent,
  keys,
  label,
  pending,
  send,
  waits,
  workflow,
  working,
}: {
  actions: ReactNode;
  allow: ComposerProps["allow"];
  canSend: boolean;
  hasContent: boolean;
  /** Whether to show the send key, Ctrl+Enter: on wide screens, where a keyboard is likely. */
  keys: boolean;
  label: string | undefined;
  pending: boolean;
  send: () => void;
  waits: string | undefined;
  workflow: boolean;
  working: boolean;
}): { sendActions?: ReactNode; sendButton?: ReactNode } {
  // Astryx's Send takes text alone: this one takes a message of images too (an Astryx gap).
  const sendButton = (
    <ChatSendButton
      isDisabled={!canSend || pending}
      isStopShown={false}
      onSend={send}
      xstyle={styles.square}
    />
  );
  const allowAll = allow && allow.count >= 2 && (
    <Button
      clickAction={allow.onAllowAll}
      isDisabled={working}
      label={`Allow all (${allow.count})`}
      variant="secondary"
    />
  );
  const beside = (steer?: ReactNode) =>
    actions || allowAll || steer ? (
      <>
        {actions}
        {allowAll}
        {steer}
      </>
    ) : undefined;
  const others = beside();
  if (workflow || label !== undefined) {
    return {
      ...(others ? { sendActions: others } : {}),
      sendButton: (
        <Button
          clickAction={send}
          isDisabled={!canSend || waits !== undefined}
          // A disabled button with a tooltip stays focusable, through `aria-disabled`.
          {...(waits === undefined ? {} : { tooltip: waits })}
          endContent={keys && <SendKeys />}
          isLoading={pending}
          label={label ?? (working ? "Start once this turn ends" : "Start the agent")}
          variant="primary"
        />
      ),
    };
  }
  return working
    ? {
        sendActions: beside(hasContent ? sendButton : undefined),
        // Stop, which the composer draws itself by its context: square as well.
        sendButton: <ChatSendButton xstyle={styles.square} />,
      }
    : { ...(others ? { sendActions: others } : {}), sendButton };
}

/**
 * The composer's footer: the controls of the workflow's run while it holds its message, else the
 * paperclip, `attach`, and the recommended message, unless the composer is unavailable.
 */
export function footerActions(
  { folder, options, recommended, workflow }: ComposerProps,
  attach: ReactNode,
  { insert, unavailable }: { insert: (message: Inserted) => void; unavailable?: string },
) {
  if (workflow) {
    return options;
  }
  // Read on its own: the composer draws before the recommendation.
  const offer = recommended && folder !== undefined && !unavailable && (
    <Suspense fallback={null}>
      <RecommendedMessage folder={folder} onInsert={insert} />
    </Suspense>
  );
  return attach || offer ? (
    <HStack align="center" gap={2} wrap="wrap">
      {attach}
      {offer}
    </HStack>
  ) : undefined;
}
