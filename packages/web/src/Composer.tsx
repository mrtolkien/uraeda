import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  type ChatComposerInputProps,
  ChatSendButton,
} from "@astryxdesign/core/Chat";
import * as stylex from "@stylexjs/stylex";
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useRef,
  useState,
} from "react";
import { useFateClient } from "react-fate";
import type { Trigger } from "uraeda-server/fate";
import { IMAGE_REFUSALS } from "uraeda-server/limits";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { type DraftImage, useChatImages } from "./attach/chatImages.ts";
import { DropHint, dropStyles } from "./attach/DropHint.tsx";
import { useImageDrop } from "./attach/useImageDrop.ts";
import { ComposerImages, useFocusAfterRemove } from "./ComposerImages.tsx";
import { useAgent } from "./data.ts";
import { refusal } from "./errors.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { sendMessage } from "./sessions.ts";
import { SessionView } from "./views.ts";

const styles = stylex.create({
  input: { height: "var(--size-composer-input)" },
});

/**
 * The composer's field: 4 rows, the same empty or full (the UI behaviour decision), its text
 * scrolling inside them.
 */
function ComposerInput(props: Omit<ChatComposerInputProps, "maxRows" | "xstyle">) {
  return <ChatComposerInput {...props} maxRows={4} xstyle={styles.input} />;
}

/** Why the draft's images stay in the composer while it holds the workflow's message. */
const WORKFLOW_KEEPS_IMAGES =
  "The workflow's message takes no images: they stay here for your next message.";

/** The composer's props. */
type ComposerProps = {
  /** Why nothing can be sent here, like a feature with no branch yet: the composer is disabled. */
  blocked?: string;
  folder?: string;
  /** The message's images, kept by the page with its text. */
  images: ReadonlyArray<DraftImage>;
  /** Why the page cannot do what it was opened for, shown under the composer. */
  notice?: string;
  onChange: (value: string) => void;
  onImagesChange: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  /**
   * Sends the text and its images elsewhere than a session, like "New change" to the change it
   * starts, with or without the agent: whether it was sent. A refusal is the caller's to show, and
   * the composer keeps the text and the images.
   */
  onSend?: (text: string, images: ReadonlyArray<DraftImage>) => Promise<boolean>;
  onSent?: (session: string) => void;
  /** The send button's label, a primary button's, instead of Send. */
  sendLabel?: string;
  session?: string;
  value: string;
  /** The workflow's trigger, while the composer holds its message. */
  workflow?: { file?: string; trigger: Trigger };
  /** Whether the session has a turn going: Stop shows, and Send steers into the turn. */
  working?: boolean;
};

/**
 * Why no image can be added now: the agent is not available, cannot read images, or the composer
 * holds the workflow's message (R42). An agent not read yet refuses nothing: the server checks the
 * message at Send.
 */
function imageRefusal(agent: ReturnType<typeof useAgent>, unavailable?: string, workflow?: object) {
  if (!agent) {
    return undefined;
  }
  return (
    unavailable ??
    (!agent.capabilities.images
      ? IMAGE_REFUSALS.noImages
      : workflow
        ? IMAGE_REFUSALS.workflowImages
        : undefined)
  );
}

/**
 * Sends the composer's message and stops its turn: a refused send puts its text and images back,
 * with the reason. The workflow's message goes alone: the draft's images stay for the next one
 * (R67).
 */
function useSend(
  { folder, images, onChange, onImagesChange, onSend, onSent, session, workflow }: ComposerProps,
  { canSend, refused, sent }: { canSend: boolean; refused: boolean; sent: () => void },
) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const withImages = workflow === undefined;
  const submit = (text: string) => {
    if (refused || !canSend || pending) {
      return;
    }
    if (onSend) {
      // The text stays until it is sent: a refusal leaves it as typed.
      setPending(true);
      void onSend(text, images).then((done) => {
        setPending(false);
        if (done) {
          onChange("");
          onImagesChange([]);
          sent();
        }
      });
      return;
    }
    const sending = withImages ? images : [];
    setError(undefined);
    onChange("");
    if (withImages) {
      onImagesChange([]);
      sent();
    }
    void sendMessage(fate, {
      ...(session === undefined ? (folder === undefined ? {} : { folder }) : { session }),
      images: sending.flatMap((image) => (image.image ? [image.image] : [])),
      text,
      ...(workflow === undefined ? {} : { workflow }),
    }).then((result) => {
      if (result.ok) {
        onSent?.(result.session);
        return;
      }
      onChange(text);
      if (sending.length > 0) {
        onImagesChange((now) => [...sending, ...now]);
      }
      setError(result.message);
    });
  };
  const stop = () => {
    if (session !== undefined) {
      setError(undefined);
      // The turn ends once the agent answers the interrupt: its live update brings the state.
      void fate.mutations.session.stop({ input: { session }, view: SessionView }).then((result) => {
        if (result.error) {
          setError(refusal(result.error).message);
        }
      });
    }
  };
  return { error, pending, stop, submit };
}

/**
 * On the phone, Return adds a line: the keyboard has no Shift to hold. Astryx sends text alone on
 * Enter: a message of images alone, or images still being saved, are this handler's (an Astryx gap,
 * see the plan).
 */
function useEnter(
  input: RefObject<ChatComposerInputHandle | null>,
  wide: boolean,
  send: (() => void) | undefined,
) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (!wide) {
      input.current?.insertText("\n");
    } else {
      send?.();
    }
  };
}

/** What the composer says under it: an error, the page's notice, or why it cannot send. */
function composerStatus(
  error: string | undefined,
  { images, notice, workflow }: ComposerProps,
  unavailable: string | undefined,
) {
  const message =
    error ??
    notice ??
    unavailable ??
    (workflow && images.length > 0 ? WORKFLOW_KEEPS_IMAGES : undefined);
  if (message === undefined) {
    return undefined;
  }
  return { message, type: (error ?? notice) ? "error" : "warning" } as const;
}

/**
 * The composer's send buttons, in its send row: Send, or "Start the agent" while it holds the
 * workflow's message, "Start once this turn ends" during a turn, or the page's own `label`. During
 * a chat's turn, Send steers the message into it, beside Stop: shown, disabled, while its images
 * are saved.
 */
function sendButtons({
  canSend,
  hasContent,
  label,
  send,
  workflow,
  working,
}: {
  canSend: boolean;
  hasContent: boolean;
  label: string | undefined;
  send: () => void;
  workflow: boolean;
  working: boolean;
}): { sendActions?: ReactNode; sendButton?: ReactNode } {
  // Astryx's Send takes text alone: this one takes a message of images too (an Astryx gap).
  const sendButton = <ChatSendButton isDisabled={!canSend} isStopShown={false} onSend={send} />;
  if (workflow || label !== undefined) {
    return {
      sendButton: (
        <Button
          clickAction={send}
          isDisabled={!canSend}
          label={label ?? (working ? "Start once this turn ends" : "Start the agent")}
          variant="primary"
        />
      ),
    };
  }
  return working ? (hasContent ? { sendActions: sendButton } : {}) : { sendButton };
}

/**
 * The composer under a transcript, on Astryx's `ChatComposer`: Send, which turns into Stop while
 * the session works, and reads "Start the agent" while it holds the workflow's message, or "Start
 * once this turn ends" while the session works on a chat. Enter sends on wide screens; on the
 * phone, Return adds a line and only the button sends. It sends to
 * `session`, else to the feature of `folder`, else to a new chat, then calls `onSent` with the
 * session's ID. A refused send keeps the text and the images, with the reason under it until the
 * next send, as a refused Stop does.
 * Images come by the paperclip, a paste, or a drop anywhere on the page, and show as thumbnails
 * above the text, dimmed while saved; Send waits for them, and takes a message of images alone. An
 * agent that cannot read images has no paperclip, and the workflow's message takes none (R60):
 * images already in the draft stay there for the next message (R67).
 * `notice` is the page's own reason under it, like the workflow's refusal to continue: with the
 * workflow's message, "Start the agent" stays, disabled, so the message never goes as a chat.
 * `blocked` disables it, with why, as when the agent is not on this machine, which disables it
 * too. It is the session page's one field: a file dropped anywhere on the page joins the message.
 * `onSend` sends elsewhere, as "New change" starts a change, under the button `sendLabel`: it needs
 * text, not the agent, and takes images whatever the agent reads, since they go into the
 * repository.
 */
export function Composer(props: ComposerProps) {
  const { blocked, images, onChange, onSend, value, workflow, working = false } = props;
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const input = useRef<ChatComposerInputHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const focusAt = useFocusAfterRemove(box, input, images);
  const name = agent?.name ?? "the agent";
  const unavailable =
    onSend || agent?.available ? blocked : `${name} is not available on this machine.`;
  const refused = workflow !== undefined && props.notice !== undefined;
  const refusedWith = onSend ? unavailable : imageRefusal(agent, unavailable, workflow);
  const attaching = useChatImages({
    images,
    onImagesChange: props.onImagesChange,
    ...(refusedWith === undefined ? {} : { refusedWith }),
  });
  const drop = useImageDrop({
    label: "the message",
    onFiles: attaching.addFiles,
    priority: 1,
    ref: box,
  });
  const saving = !workflow && images.some((image) => !image.image);
  // A started change needs its title: images alone are not one.
  const hasContent = value.trim() !== "" || (!workflow && !onSend && images.length > 0);
  const canSend = hasContent && !saving && !unavailable;
  const { error, pending, stop, submit } = useSend(props, {
    canSend,
    refused,
    sent: attaching.sent,
  });
  const onKeyDown = useEnter(input, wide, canSend ? () => submit(value.trim()) : undefined);
  const placeholder = `Message ${name}`;
  const buttons = sendButtons({
    canSend: canSend && !refused && !pending,
    hasContent,
    label: props.sendLabel,
    send: () => submit(value.trim()),
    workflow: workflow !== undefined,
    working,
  });

  return (
    <>
      <DropHint hint={drop.hint}>
        <ChatComposer
          drawer={
            images.length > 0 ? (
              <ComposerImages focusAt={focusAt} images={images} onRemove={attaching.remove} />
            ) : undefined
          }
          footerActions={
            (onSend || agent?.capabilities.images) && !workflow ? (
              <AttachButton
                isDisabled={Boolean(unavailable)}
                isIconOnly
                multiple
                onFiles={attaching.addFiles}
              />
            ) : undefined
          }
          input={
            <ComposerInput
              handleRef={input}
              label={placeholder}
              onFiles={attaching.addFiles}
              onKeyDown={onKeyDown}
            />
          }
          isDisabled={Boolean(unavailable)}
          isStopShown={working && !workflow}
          onChange={onChange}
          onStop={stop}
          onSubmit={submit}
          placeholder={placeholder}
          ref={box}
          sendActions={buttons.sendActions}
          sendButton={buttons.sendButton}
          status={composerStatus(error, props, unavailable)}
          value={value}
          xstyle={drop.isTarget ? dropStyles.target : undefined}
        />
      </DropHint>
      <AttachStatus status={attaching.status} />
    </>
  );
}
