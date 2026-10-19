import { Button } from "@astryxdesign/core/Button";
import { ChatSendButton } from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { ComposerProps } from "./Composer.tsx";
import { type Inserted, RecommendedMessage } from "./RecommendedMessage.tsx";

/**
 * The composer's send buttons, in its send row: Send, or "Start the agent" while it holds the
 * workflow's message, "Start once this turn ends" during a turn, or the page's own `label`. During
 * a chat's turn, Send steers the message into it, beside Stop: shown, disabled, while its images
 * are saved. While `onSend` is `pending`, the page's button is busy, its spinner shown.
 */
export function sendButtons({
  canSend,
  hasContent,
  label,
  pending,
  send,
  waits,
  workflow,
  working,
}: {
  canSend: boolean;
  hasContent: boolean;
  label: string | undefined;
  pending: boolean;
  send: () => void;
  waits: string | undefined;
  workflow: boolean;
  working: boolean;
}): { sendActions?: ReactNode; sendButton?: ReactNode } {
  // Astryx's Send takes text alone: this one takes a message of images too (an Astryx gap).
  const sendButton = (
    <ChatSendButton isDisabled={!canSend || pending} isStopShown={false} onSend={send} />
  );
  if (workflow || label !== undefined) {
    return {
      sendButton: (
        <Button
          clickAction={send}
          isDisabled={!canSend || waits !== undefined}
          // A disabled button with a tooltip stays focusable, through `aria-disabled`.
          {...(waits === undefined ? {} : { tooltip: waits })}
          isLoading={pending}
          label={label ?? (working ? "Start once this turn ends" : "Start the agent")}
          variant="primary"
        />
      ),
    };
  }
  return working ? (hasContent ? { sendActions: sendButton } : {}) : { sendButton };
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
