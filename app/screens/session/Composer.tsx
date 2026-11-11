// The session's composer: what the human sends the agent, at the end of the conversation, in the
// same pane. Enter sends, as a chat does, Shift+Enter adds a line (the library's `Composer`), and a
// send is sent once: a second Enter while it goes does nothing. The text leaves the field at once
// (rule 6) and comes back, with the server's words under it, if the server refuses it. While the
// agent works, a message joins its turn where the agent takes one (`steer`), else waits for the
// turn's end: the composer says which. Images come by the paperclip, a paste, or a drop on the
// pane, each kept by the server as it comes (`attach.ts`), and Send waits for them. Stop is `S`,
// a key of its own beside nothing that sends.
import { Clipboard, effect, Image, signal, untracked, View } from "nsh";
import { call, StoreError } from "../../store";
import type { ChatImage, RuntimeRecord, Session } from "../../store/protocol";
import { Button, IconButton, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import {
  Composer as Field,
  dropUnsaved,
  readUnsaved,
  type TextFieldRef,
  writeUnsaved,
} from "../../ui/text";
import { type Held, keepForChat, pastedImage, pickImages } from "../images";

/** An image of the message: held, then kept by the server, or refused. */
type Attached = { held: Held; image?: ChatImage; refusal?: string };

/** Each draft's images, by its key, while the app runs: bytes, not text. */
const images = signal<Readonly<Record<string, ReadonlyArray<Attached>>>>({});

const imagesOf = (key: string) => images()[key] ?? [];

function setImages(key: string, next: ReadonlyArray<Attached>) {
  images.set({ ...untracked(images), [key]: next });
}

/** Holds more images for the draft `key`, and sends each to the server as it comes. */
export function attach(repo: string, key: string, held: ReadonlyArray<Held>) {
  if (held.length === 0) return;
  setImages(key, [...untracked(() => imagesOf(key)), ...held.map((one) => ({ held: one }))]);
  for (const one of held) {
    const done = (change: Partial<Attached>) =>
      setImages(
        key,
        untracked(() => imagesOf(key)).map((each) =>
          each.held === one ? Object.assign({}, each, change) : each,
        ),
      );
    keepForChat(repo, one).then(
      ({ height, id, width }) => done({ image: { height, id, width } }),
      (error: Error) => done({ refusal: error.message }),
    );
  }
}

/** Puts a message taken back in the draft `key`, before what it holds. */
export function putBack(key: string, text: string) {
  const held = readUnsaved(key)?.text ?? "";
  writeUnsaved(key, {
    at: new Date().toISOString(),
    base: "",
    text: held.trim() === "" ? text : `${text}\n\n${held}`,
  });
}

/** The draft's key on the device: the session's, or a feature's next new session's. */
export const draftKey = (repo: string, session: string | null, folder: string) =>
  `${repo}:session:${session ?? `${folder}#new`}`;

export type SessionComposerProps = {
  /** Where the message goes: the session, else a new one of the feature in `folder`. */
  folder: string;
  /** A new session of the feature, made with this message, not its latest. */
  fresh: boolean;
  /** A sub-session, which its parent's run speaks to: no field, only Stop. */
  readOnly?: boolean;
  /** Hears where a message went, once the server took it. */
  onSent?: (session: string) => void;
  ref?: (field: TextFieldRef) => void;
  repo: string;
  /** The runtime it runs on, from the record `Agent`. */
  runtime: RuntimeRecord | undefined;
  session: Session | null;
};

/** Why nothing can be sent: the agent off here, or gone; none while it can be. */
function blockedWords(runtime: RuntimeRecord | undefined, session: Session | null) {
  if (session === null || runtime === undefined) return undefined;
  if (!runtime.isOn) {
    return `${runtime.name} is off in this repository: turn it on in Settings, Extensions, to go on with this session.`;
  }
  if (!runtime.available) return `${runtime.name} is not available on this machine.`;
  return undefined;
}

export function SessionComposer(props: SessionComposerProps) {
  const key = () => draftKey(props.repo, props.session?.id ?? null, props.folder);
  const value = () => readUnsaved(key())?.text ?? "";
  const change = (text: string) => {
    if (text === "") dropUnsaved(key());
    else writeUnsaved(key(), { at: new Date().toISOString(), base: "", text });
  };
  const sending = signal(false);
  const stopping = signal(false);
  const refusal = signal<string | null>(null);
  let field: TextFieldRef | undefined;

  const working = () => props.session?.status === "working";
  const waits = () => props.session?.wait !== null && props.session?.wait !== undefined;
  const blocked = () => blockedWords(props.runtime, props.session);
  const held = () => imagesOf(key());
  const saving = () => held().some((one) => one.image === undefined && one.refusal === undefined);

  const send = async () => {
    const text = untracked(value).trim();
    const attached = untracked(held);
    if (untracked(sending) || untracked(saving) || (text === "" && attached.length === 0)) return;
    const draft = untracked(key);
    sending.set(true);
    refusal.set(null);
    change("");
    setImages(draft, []);
    const session = props.session;
    try {
      const sent = await call("session.send", {
        images: attached.flatMap((one) => (one.image === undefined ? [] : [one.image])),
        repo: props.repo,
        text,
        ...(session === null
          ? { folder: props.folder, ...(props.fresh ? { newSession: true } : {}) }
          : { session: session.id }),
      });
      props.onSent?.(sent.session);
    } catch (error) {
      // Back where the hand was, with why: the text, and the images, unless typed over meanwhile.
      if ((readUnsaved(draft)?.text ?? "") === "") {
        writeUnsaved(draft, { at: new Date().toISOString(), base: "", text });
      }
      setImages(draft, [...attached, ...imagesOf(draft)]);
      refusal.set(error instanceof StoreError ? error.message : String(error));
    } finally {
      sending.set(false);
    }
  };

  const stop = async () => {
    const session = props.session;
    if (session === null || untracked(stopping)) return;
    stopping.set(true);
    refusal.set(null);
    try {
      await call("session.stop", { repo: props.repo, session: session.id });
    } catch (error) {
      refusal.set(error instanceof StoreError ? error.message : String(error));
    } finally {
      stopping.set(false);
    }
  };

  const paste = async () => {
    const image = await pastedImage();
    if (image !== undefined) {
      attach(props.repo, untracked(key), [image]);
      return;
    }
    field?.insert(await Clipboard.readText());
  };

  registerKey([
    {
      hint: "i",
      hintLabel: "write",
      icon: "pencil",
      keys: "i",
      label: "Write a message",
      run: () => {
        if (blocked() !== undefined || props.readOnly === true) return false;
        field?.focus();
        return undefined;
      },
    },
    {
      icon: "image-plus",
      inField: true,
      keys: "mod+v",
      label: "Paste, an image for the message",
      run: () => void paste(),
    },
  ]);
  // Stop, only while there is something to stop: the status line names it then.
  effect(() => {
    if (!working() && !waits()) return;
    registerKey({
      hint: "S",
      hintLabel: "stop",
      icon: "square",
      keys: "S",
      label: "Stop the agent",
      run: () => void stop(),
    });
  });

  const hint = () => {
    if (sending()) return "Sending…";
    if (saving()) return "Keeping the images: Send waits for them.";
    if (!working()) return undefined;
    return props.runtime?.capabilities.steer === true
      ? "The agent works: your message joins its turn."
      : "The agent works: your message goes once its turn ends.";
  };

  return (
    <View style={{ gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
      <If when={blocked()}>
        {(words) => (
          <Text tone="caution" testID="composer-blocked">
            {words()}
          </Text>
        )}
      </If>
      <View
        style={{
          alignItems: "flex-end",
          display: props.readOnly === true ? "none" : "flex",
          flexDirection: "row",
          gap: 4,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Field
            attached={held().filter((one) => one.image !== undefined).length}
            attachments={
              <Images
                images={held()}
                onRemove={(one) =>
                  setImages(
                    key(),
                    held().filter((each) => each !== one),
                  )
                }
              />
            }
            disabled={blocked() !== undefined || saving()}
            label={`Message ${props.runtime?.name ?? "the agent"}`}
            onChange={change}
            onSend={() => void send()}
            placeholder={`Message ${props.runtime?.name ?? "the agent"}`}
            queued={hint()}
            ref={(made) => {
              field = made;
              props.ref?.(made);
            }}
            refusal={refusal()}
            testID="composer"
            value={value()}
          />
        </View>
        <IconButton
          disabled={blocked() !== undefined}
          icon="paperclip"
          label="Attach images"
          onPress={() => void pickImages().then((picked) => attach(props.repo, key(), picked))}
        />
      </View>
      <If when={working() || waits()}>
        <View style={{ alignItems: "flex-start" }}>
          <Button
            icon="square"
            label={working() ? "Stop the agent" : "Stop the wait"}
            onPress={() => void stop()}
            pending={stopping()}
            testID="stop"
            variant="danger"
          />
        </View>
      </If>
    </View>
  );
}

/** The images of the message, each with the way to take it out, or why it was refused. */
function Images(props: { images: ReadonlyArray<Attached>; onRemove: (one: Attached) => void }) {
  return (
    <If when={props.images.length > 0}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Each of={props.images}>
          {(one) => (
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 2 }}>
              <Image
                accessibilityLabel={one().held.name || "Pasted image"}
                src={one().held.url}
                style={{ height: 56, opacity: one().image === undefined ? 0.5 : 1, width: 56 }}
              />
              <IconButton
                icon="x"
                label="Take the image out"
                onPress={() => props.onRemove(one())}
              />
              <If when={one().refusal}>
                {(words) => (
                  <Text size="under" tone="danger">
                    {words()}
                  </Text>
                )}
              </If>
            </View>
          )}
        </Each>
      </View>
    </If>
  );
}
