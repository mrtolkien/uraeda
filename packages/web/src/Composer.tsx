import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  type ChatComposerInputProps,
  ChatSendButton,
} from "@astryxdesign/core/Chat";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import * as stylex from "@stylexjs/stylex";
import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
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

/**
 * What the status region says: that the agent replies while the session works, and that the reply
 * is complete once it stops working, never on a session already idle when shown.
 */
function useReplyStatus(agentName: string, working: boolean): string {
  const [said, setSaid] = useState(working ? `${agentName} is replying` : "");
  const was = useRef(working);
  useEffect(() => {
    if (working && !was.current) {
      setSaid(`${agentName} is replying`);
    } else if (!working && was.current) {
      setSaid("Reply complete");
    }
    was.current = working;
  }, [agentName, working]);
  return said;
}

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
  onSent?: (session: string) => void;
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
  { folder, images, onChange, onImagesChange, onSent, session, value, workflow }: ComposerProps,
  { canSend, refused, sent }: { canSend: boolean; refused: boolean; sent: () => void },
) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const withImages = workflow === undefined;
  const submit = (text: string) => {
    if (refused || !canSend) {
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
  return { error, stop, submit };
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
 */
export function Composer(props: ComposerProps) {
  const { blocked, images, onChange, value, workflow, working = false } = props;
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const input = useRef<ChatComposerInputHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const focusAt = useFocusAfterRemove(box, input, images);
  const name = agent?.name ?? "the agent";
  const status = useReplyStatus(name, working);
  const unavailable = agent?.available ? blocked : `${name} is not available on this machine.`;
  const refused = workflow !== undefined && props.notice !== undefined;
  const refusedWith = imageRefusal(agent, unavailable, workflow);
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
  const hasContent = value.trim() !== "" || (!workflow && images.length > 0);
  const canSend = hasContent && !saving && !unavailable;
  const { error, stop, submit } = useSend(props, { canSend, refused, sent: attaching.sent });
  const onKeyDown = useEnter(input, wide, canSend ? () => submit(value.trim()) : undefined);
  const placeholder = `Message ${name}`;
  // Astryx's Send takes text alone: this one takes a message of images too (an Astryx gap).
  const send = (
    <ChatSendButton
      isDisabled={!canSend || refused}
      isStopShown={false}
      onSend={() => submit(value.trim())}
    />
  );

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
            agent?.capabilities.images && !workflow ? (
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
          // During a turn, Send steers the message into it, beside Stop: shown, disabled, while
          // its images are saved.
          sendActions={working && hasContent && !workflow ? send : undefined}
          sendButton={
            workflow ? (
              <Button
                clickAction={() => submit(value.trim())}
                isDisabled={!canSend || refused}
                label={working ? "Start once this turn ends" : "Start the agent"}
                variant="primary"
              />
            ) : working ? undefined : (
              send
            )
          }
          status={composerStatus(error, props, unavailable)}
          value={value}
          xstyle={drop.isTarget ? dropStyles.target : undefined}
        />
      </DropHint>
      <AttachStatus status={attaching.status} />
      <VisuallyHidden as="div" role="status">
        {status}
      </VisuallyHidden>
    </>
  );
}
