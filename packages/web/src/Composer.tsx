import { Button } from "@astryxdesign/core/Button";
import {
  ChatComposer,
  ChatComposerDrawer,
  ChatComposerInput,
  type ChatComposerInputHandle,
  ChatSendButton,
} from "@astryxdesign/core/Chat";
import { HStack } from "@astryxdesign/core/HStack";
import { Thumbnail } from "@astryxdesign/core/Thumbnail";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import {
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFateClient } from "react-fate";
import type { ChatImage, Trigger } from "uraeda-server/fate";
import { IMAGE_REFUSALS, MAX_IMAGES } from "uraeda-server/limits";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint, dropStyles } from "./attach/DropHint.tsx";
import { useServerFetch } from "./attach/ServerFetch.tsx";
import { type AttachResult, useAttach } from "./attach/useAttach.ts";
import { useImageDrop } from "./attach/useImageDrop.ts";
import { useAgent } from "./data.ts";
import { refusal } from "./errors.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useRepository } from "./routes.tsx";
import { chatImageSrc, sendMessage } from "./sessions.ts";
import { SessionView } from "./views.ts";

/**
 * An image of the composer's message: being saved, with the file's own preview, then saved, with
 * the chat image `POST /attach` returned. `name` labels its thumbnail.
 */
export type DraftImage = { key: string; name: string; preview?: string; image?: ChatImage };

/** Each draft image's key, unique across the composers a page draws in turn. */
let nextKey = 0;

/** A chat image back in the composer, like a taken-back message's. */
export function draftImage(image: ChatImage): DraftImage {
  nextKey += 1;
  return { key: `image-${nextKey}`, name: "Image", image };
}

/** A file's own image, shown while it is saved, or nothing where the browser makes none. */
function previewOf(file: File): string | undefined {
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

function forget(preview: string | undefined) {
  if (preview !== undefined) {
    try {
      URL.revokeObjectURL(preview);
    } catch {
      // Nothing to free.
    }
  }
}

/**
 * The composer's images, kept by the page with its text: added by the picker, a paste, or a drop,
 * saved one after the other to the data folder, and removed with their files. Refuses images to an
 * agent that cannot read them, to the workflow's message, and past 10.
 */
function useChatImages({
  images,
  onImagesChange,
  refusedWith,
}: {
  images: ReadonlyArray<DraftImage>;
  onImagesChange: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  /** Why no image can be added now, if none can. */
  refusedWith?: string;
}) {
  const fetch = useServerFetch();
  const attach = useAttach({ chat: true });
  // The images as last set, read by files added before React draws the ones added just before.
  const current = useRef(images);
  current.current = images;
  // Uploads go one after the other, in the order the files came (R49).
  const queue = useRef(Promise.resolve());
  // Whether the status is shown: a sent message takes the last "Added" away with it.
  const [shown, setShown] = useState(true);

  const remove = (key: string) => {
    const gone = current.current.find((image) => image.key === key);
    current.current = current.current.filter((image) => image.key !== key);
    onImagesChange((now) => now.filter((image) => image.key !== key));
    forget(gone?.preview);
    // An image still being saved is deleted once saved.
    if (gone?.image) {
      void fetch(chatImageSrc(gone.image), { method: "DELETE" }).catch(() => undefined);
    }
  };

  const settle = (added: DraftImage, result: AttachResult) => {
    forget(added.preview);
    const kept = current.current.some((image) => image.key === added.key);
    if (!result.ok) {
      remove(added.key);
      return;
    }
    const image = result.value as ChatImage;
    if (!kept) {
      // Removed while it was saved.
      void fetch(chatImageSrc(image), { method: "DELETE" }).catch(() => undefined);
      return;
    }
    const saved = { key: added.key, name: added.name, image };
    current.current = current.current.map((one) => (one.key === added.key ? saved : one));
    onImagesChange((now) => now.map((one) => (one.key === added.key ? saved : one)));
  };

  const addFiles = (files: File[]) => {
    setShown(true);
    if (refusedWith !== undefined) {
      attach.show(refusedWith, true);
      return;
    }
    const taken = files.slice(0, Math.max(0, MAX_IMAGES - current.current.length));
    const added = taken.map((file): DraftImage => {
      nextKey += 1;
      const preview = previewOf(file);
      return {
        key: `image-${nextKey}`,
        name: file.name || "pasted image",
        ...(preview === undefined ? {} : { preview }),
      };
    });
    current.current = [...current.current, ...added];
    onImagesChange((now) => [...now, ...added]);
    taken.forEach((file, index) => {
      queue.current = queue.current.then(async () => {
        const [result] = await attach.attach([file]);
        settle(added[index], result);
      });
    });
    if (taken.length < files.length) {
      // Shown once the images taken are saved, so their statuses do not hide it.
      queue.current = queue.current.then(() => attach.show(IMAGE_REFUSALS.tooManyImages, true));
    }
  };

  return {
    addFiles,
    remove,
    status: shown ? attach.status : undefined,
    /** Hides the status, as a sent message's images leave the composer. */
    sent: () => setShown(false),
  };
}

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
 * agent that cannot read images has no paperclip, and the workflow's message takes none (R60).
 * `notice` is the page's own reason under it, like the workflow's refusal to continue: with the
 * workflow's message, "Start the agent" stays, disabled, so the message never goes as a chat.
 * `blocked` disables it, with why, as when the agent is not on this machine.
 */
export function Composer({
  blocked,
  session,
  folder,
  working = false,
  value,
  onChange,
  images,
  onImagesChange,
  workflow,
  notice,
  onSent,
}: {
  /** Why nothing can be sent here, like a feature with no branch yet: the composer is disabled. */
  blocked?: string;
  session?: string;
  folder?: string;
  /** Whether the session has a turn going: Stop shows, and Send steers into the turn. */
  working?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** The message's images, kept by the page with its text. */
  images: ReadonlyArray<DraftImage>;
  onImagesChange: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  /** The workflow's trigger, while the composer holds its message. */
  workflow?: { file?: string; trigger: Trigger };
  /** Why the page cannot do what it was opened for, shown under the composer. */
  notice?: string;
  onSent?: (session: string) => void;
}) {
  const fate = useFateClient();
  const repo = useRepository();
  const agent = useAgent();
  const wide = useWidthClass() === "wide";
  const input = useRef<ChatComposerInputHandle>(null);
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const name = agent?.name ?? "the agent";
  const status = useReplyStatus(name, working);
  // Why nothing can be sent: the agent is not on this machine, or the page says why.
  const unavailable = agent?.available ? blocked : `${name} is not available on this machine.`;
  const refused = workflow !== undefined && notice !== undefined;
  // An agent that cannot read images has no attach button; the workflow's message takes none (R42).
  const readsImages = Boolean(agent?.capabilities.images);
  const attaching = useChatImages({
    images,
    onImagesChange,
    ...(!readsImages
      ? { refusedWith: IMAGE_REFUSALS.noImages }
      : workflow
        ? { refusedWith: IMAGE_REFUSALS.workflowImages }
        : {}),
  });
  // The session page's one field: a file dropped anywhere on it joins the message.
  const drop = useImageDrop({
    ref: box,
    priority: 1,
    onFiles: attaching.addFiles,
    label: "the message",
  });
  const saving = images.some((image) => !image.image);
  const canSend = (value.trim() !== "" || images.length > 0) && !saving && !unavailable;

  const submit = (text: string) => {
    if (refused || !canSend) {
      return;
    }
    const sending = images;
    setError(undefined);
    onChange("");
    onImagesChange([]);
    attaching.sent();
    void sendMessage(fate, {
      ...(session === undefined ? (folder === undefined ? {} : { folder }) : { session }),
      text,
      images: sending.flatMap((image) => (image.image ? [image.image] : [])),
      ...(workflow === undefined ? {} : { workflow }),
    }).then((sent) => {
      if (sent.ok) {
        onSent?.(sent.session);
      } else {
        onChange(text);
        onImagesChange((now) => [...sending, ...now]);
        setError(sent.message);
      }
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
  // On the phone, Return adds a line: the keyboard has no Shift to hold. Astryx sends text alone
  // on Enter: a message of images alone, or images still being saved, are this handler's (an Astryx
  // gap, see the plan).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    if (!wide) {
      input.current?.insertText("\n");
    } else if (canSend) {
      submit(value.trim());
    }
  };
  const placeholder = `Message ${name}`;
  // Astryx's Send takes text alone: this one takes a message of images too (an Astryx gap).
  const send = (
    <ChatSendButton
      isStopShown={false}
      isDisabled={!canSend || refused}
      onSend={() => submit(value.trim())}
    />
  );

  return (
    <>
      <DropHint hint={drop.hint}>
        <ChatComposer
          ref={box}
          value={value}
          onChange={onChange}
          onSubmit={submit}
          onStop={stop}
          isStopShown={working && !workflow}
          placeholder={placeholder}
          isDisabled={Boolean(unavailable)}
          xstyle={drop.isTarget ? dropStyles.target : undefined}
          drawer={
            images.length > 0 ? (
              <ChatComposerDrawer label="Images">
                <HStack gap={2} wrap="wrap">
                  {images.map((image) => (
                    <Thumbnail
                      key={image.key}
                      src={image.image ? chatImageSrc(repo, image.image) : image.preview}
                      label={image.name}
                      isLoading={!image.image}
                      showRemoveOn="always"
                      onRemove={() => attaching.remove(image.key)}
                    />
                  ))}
                </HStack>
              </ChatComposerDrawer>
            ) : undefined
          }
          input={
            <ChatComposerInput
              label={placeholder}
              handleRef={input}
              onKeyDown={onKeyDown}
              onFiles={attaching.addFiles}
            />
          }
          footerActions={
            readsImages && !workflow ? (
              <AttachButton
                multiple
                isIconOnly
                isDisabled={Boolean(unavailable)}
                onFiles={attaching.addFiles}
              />
            ) : undefined
          }
          sendActions={
            // During a turn, Send steers the message into it, beside Stop.
            working && canSend && !workflow ? send : undefined
          }
          sendButton={
            workflow ? (
              <Button
                variant="primary"
                label={working ? "Start once this turn ends" : "Start the agent"}
                isDisabled={!canSend || refused}
                clickAction={() => submit(value.trim())}
              />
            ) : working ? undefined : (
              send
            )
          }
          status={
            error
              ? { type: "error", message: error }
              : notice
                ? { type: "error", message: notice }
                : unavailable
                  ? { type: "warning", message: unavailable }
                  : undefined
          }
        />
      </DropHint>
      <AttachStatus status={attaching.status} />
      <VisuallyHidden as="div" role="status">
        {status}
      </VisuallyHidden>
    </>
  );
}
