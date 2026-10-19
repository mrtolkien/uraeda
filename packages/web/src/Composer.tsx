import {
  ChatComposer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  type ChatComposerInputProps,
} from "@astryxdesign/core/Chat";
import * as stylex from "@stylexjs/stylex";
import {
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
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
import { FreshDefault, useFreshRun } from "./HandOver.tsx";
import { footerActions, sendButtons } from "./ComposerSend.tsx";
import { type Inserted, withInserted } from "./RecommendedMessage.tsx";
import { sendMessage } from "./sessions.ts";
import { SessionView } from "./views.ts";
import { clearPending, markPending } from "./writes/store.ts";

const styles = stylex.create({
  input: { minHeight: "var(--size-composer-input)" },
});

/**
 * The composer's field: 7 rows empty, growing upward with its text up to 20 (the UI behaviour
 * decision), its text scrolling inside them past that.
 */
function ComposerInput(props: Omit<ChatComposerInputProps, "maxRows" | "xstyle">) {
  return <ChatComposerInput {...props} maxRows={20} xstyle={styles.input} />;
}

/** Why the draft's images stay in the composer while it holds the workflow's message. */
const WORKFLOW_KEEPS_IMAGES =
  "The workflow's message takes no images: they stay here for your next message.";

/** The workflow's run a message starts, while the composer holds it. */
type Workflow = { file?: string; fresh?: boolean; step?: string; trigger: Trigger };

/** The composer's props. */
export type ComposerProps = {
  /** Why nothing can be sent here, like a feature with no branch yet: the composer is disabled. */
  blocked?: string;
  folder?: string;
  /** The message's images, kept by the page with its text. */
  images: ReadonlyArray<DraftImage>;
  /**
   * Why the page cannot do what it was opened for, shown under the composer, which still sends what
   * it holds, as a chat.
   */
  notice?: string;
  onChange: (value: string) => void;
  onImagesChange: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  /**
   * Sends the text and its images elsewhere than a session, like "New change" to the change it
   * starts, with or without the agent: whether it was sent. A refusal is the caller's to show, and
   * the composer keeps the text and the images. A sent text is the caller's to clear: it may answer
   * once the page is gone, and only the caller knows the text kept by then.
   */
  onSend?: (text: string, images: ReadonlyArray<DraftImage>) => Promise<boolean>;
  onSent?: (session: string) => void;
  /** The controls of the workflow's run, in the composer's footer while it holds its message. */
  options?: ReactNode;
  /** Whether it offers the recommended message of the feature in `folder`. */
  recommended?: boolean;
  /** The send button's label, a primary button's, instead of Send. */
  sendLabel?: string;
  /** Why the page's own send button waits, as for another page's git write: its tooltip. */
  sendWaits?: string | undefined;
  session?: string;
  value: string;
  /**
   * The workflow's trigger, whether its run starts fresh, and the step its message was read at,
   * while the composer holds its message.
   */
  workflow?: Workflow;
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
  { canSend, sent }: { canSend: boolean; sent: () => void },
) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const withImages = workflow === undefined;
  const submit = (text: string) => {
    if (!canSend || pending) {
      return;
    }
    if (onSend) {
      // The text stays until it is sent, and `onSend` clears it: a refusal leaves it as typed.
      setPending(true);
      void onSend(text, images).then((done) => {
        setPending(false);
        if (done) {
          onImagesChange([]);
          sent();
        }
      });
      return;
    }
    const sending = withImages ? images : [];
    setError(undefined);
    // The feature's card says so at once, until the server's status for it changes.
    const starting = workflow !== undefined ? folder : undefined;
    if (starting !== undefined) {
      markPending(starting, "Starting the agent…");
    }
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
      if (starting !== undefined) {
        clearPending(starting);
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
      if (folder !== undefined) {
        markPending(folder, "Stopping…");
      }
      // The turn ends once the agent answers the interrupt: its live update brings the state.
      void fate.mutations.session.stop({ input: { session }, view: SessionView }).then((result) => {
        if (result.error) {
          if (folder !== undefined) {
            clearPending(folder);
          }
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
 * The recommended message inserted (R30): its run, the composer's workflow unless the page gives
 * one, until it is sent or the human empties the field. `props` are the composer's, with that
 * workflow; `edit` is the field's change, and `insert` puts the message before what was typed.
 * After a spec's approval, the run builds in a fresh session as the setting says, with the
 * hand-over's switch: `reader` reads the setting once a message is inserted.
 */
function useInserted(given: ComposerProps) {
  const [inserted, setInserted] = useState<Workflow>();
  // Each insert keys its fresh session switch, which starts from the setting (the agents decision).
  const [inserts, setInserts] = useState(0);
  const fresh = useFreshRun(`inserted:${inserts}`);
  const run = inserted === undefined ? undefined : fresh.handing(inserted);
  const workflow = given.workflow ?? run?.workflow;
  const options = given.workflow ? given.options : run?.options;
  const props: ComposerProps = {
    ...given,
    ...(options === undefined ? {} : { options }),
    onSent: (session) => {
      setInserted(undefined);
      given.onSent?.(session);
    },
    ...(workflow === undefined ? {} : { workflow }),
  };
  return {
    edit: (next: string) => {
      // Emptied: the inserted message's run goes with its text.
      if (next.trim() === "") {
        setInserted(undefined);
      }
      given.onChange(next);
    },
    insert: ({ text, ...message }: Inserted) => {
      setInserted(message);
      setInserts(inserts + 1);
      given.onChange(withInserted(text, given.value));
    },
    /** How many times a message was inserted. */
    inserts,
    props,
    // Read once inserted: the session page draws without waiting for the settings.
    reader: inserted && (
      <FreshDefault
        onRead={(byDefault) => fresh.read(byDefault === undefined ? {} : { fresh: byDefault })}
        step={inserted.step ?? ""}
      />
    ),
  };
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
 * `notice` is the page's own reason under it, like the workflow's refusal to continue: the page
 * then holds no workflow, and Send sends what was typed as a chat.
 * `recommended` offers the feature's recommended message beside Send, while the composer holds no
 * workflow's message: "Insert: <name>" puts it before what was typed, unsent, and makes the send a
 * workflow run, "Start the agent", until it is sent or the composer is emptied.
 * `blocked` disables it, with why, as when the agent is not on this machine, which disables it
 * too. It is the session page's one field: a file dropped anywhere on the page joins the message.
 * `onSend` sends elsewhere, as "New change" starts a change, under the button `sendLabel`: it needs
 * text, not the agent, and takes images whatever the agent reads, since they go into the
 * repository.
 */
export function Composer(given: ComposerProps) {
  const { blocked, images, onSend, value, working = false } = given;
  const { edit, insert, inserts, props, reader } = useInserted(given);
  const { workflow } = props;
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const input = useRef<ChatComposerInputHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const focusAt = useFocusAfterRemove(box, input, images);
  const name = agent?.name ?? "the agent";
  const unavailable =
    onSend || agent?.available ? blocked : `${name} is not available on this machine.`;
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
  // Another page's write blocks the page's own send, not the typing.
  const canSend = hasContent && !saving && !unavailable && props.sendWaits === undefined;
  const { error, pending, stop, submit } = useSend(props, {
    canSend,
    sent: attaching.sent,
  });
  const onKeyDown = useEnter(input, wide, canSend ? () => submit(value.trim()) : undefined);
  const placeholder = `Message ${name}`;
  // The button goes once inserted: the field takes the focus, for Enter or more keys.
  useEffect(() => {
    if (inserts > 0) {
      input.current?.focus();
    }
  }, [inserts]);
  const buttons = sendButtons({
    canSend,
    hasContent,
    label: props.sendLabel,
    pending,
    send: () => submit(value.trim()),
    waits: props.sendWaits,
    workflow: workflow !== undefined,
    working,
  });

  const attach = (onSend || agent?.capabilities.images) && (
    <AttachButton
      isDisabled={Boolean(unavailable)}
      isIconOnly
      multiple
      onFiles={attaching.addFiles}
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
          footerActions={footerActions(props, attach, { insert, unavailable })}
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
          onChange={edit}
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
      {reader}
    </>
  );
}
