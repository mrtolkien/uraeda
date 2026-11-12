// The inbox's add: the first thing in its pane, one tap or `a` away, as the inbox is where a
// thought is dropped in two seconds. Enter adds the note and keeps the field for the next one. Its
// text is kept on the device as it is typed, so a note typed and not added is there after a
// restart; the images held for it (picked, pasted, or dropped) stay while the app runs.
import { Image, signal, View } from "nsh";
import { call } from "../../store";
import type { Inbox } from "../../store/protocol";
import { IconButton, Text } from "../../ui/controls";
import { type Taken, TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import type { Held } from "../images";
import { sendImages } from "./images";
import { quoted } from "./model";
import { remember } from "../shell/undo";

/** The images held for each repository's next note, while the app runs: bytes, not text. */
const held = signal<Readonly<Record<string, ReadonlyArray<Held>>>>({});

/** The images held for the next note of `repo`. */
export const heldFor = (repo: string) => held()[repo] ?? [];

/** Holds more images for the next note of `repo`. */
export function holdImages(repo: string, images: ReadonlyArray<Held>) {
  if (images.length > 0) held.set({ ...held(), [repo]: [...heldFor(repo), ...images] });
}

const release = (repo: string, keep: (image: Held) => boolean = () => false) =>
  held.set({ ...held(), [repo]: heldFor(repo).filter(keep) });

/** The images held for `repo`, as a note sent takes them: back before those added since. */
const imagesOf = (repo: string): Taken<ReadonlyArray<Held>> => ({
  putBack: (taken) => held.set({ ...held(), [repo]: [...taken, ...heldFor(repo)] }),
  take: () => {
    const taken = heldFor(repo);
    release(repo);
    return taken;
  },
});

/** A row of images not sent yet, each with the way to take it out. */
export function HeldImages(props: {
  images: ReadonlyArray<Held>;
  onRemove: (image: Held) => void;
}) {
  return (
    <If when={props.images.length > 0}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Each of={props.images}>
          {(image) => (
            <View style={{ alignItems: "flex-start", flexDirection: "row" }}>
              <Image
                accessibilityLabel={image().name || "Pasted image"}
                src={image().url}
                style={{ height: 56, width: 56 }}
              />
              <IconButton
                icon="x"
                label="Take the image out"
                onPress={() => props.onRemove(image())}
              />
            </View>
          )}
        </Each>
      </View>
    </If>
  );
}

export type AddNoteProps = {
  /** The category it adds to: `null` for the notes without one. */
  category: string | null;
  inbox: Inbox;
  /** Takes the focus as it is drawn: the page was opened to add a note. */
  focus?: boolean;
  onCategory: (category: string | null) => void;
  /** Hears whether the field has the focus: a paste goes to the field then. */
  onFocused: (focused: boolean) => void;
  ref?: (field: TextFieldRef) => void;
  repo: string;
};

export function AddNote(props: AddNoteProps) {
  const field = unsavedText(unsavedKey(props.repo, "specs/INBOX.md#new-note"), () => "", {
    gap: " ",
  });
  const refusal = signal<string | null>(null);
  const added = signal<string | null>(null);
  const images = () => heldFor(props.repo);

  const add = async () => {
    const text = field.text().trim();
    if (field.pending()) return;
    if (text === "") {
      refusal.set(
        images().length > 0 ? "A note with images needs text too." : "A note needs text.",
      );
      return;
    }
    refusal.set(null);
    const { category, repo } = props;
    const hash = props.inbox.hash;
    // The note leaves the field with its images, which is free for the next one.
    const done = await field.send(async (_, sent) => {
      if (sent.length > 0) {
        await sendImages(repo, hash, { category, text }, sent);
        return;
      }
      const written = await call("inbox.add", { category, hash, repo, text });
      // The field says it was added: the stack keeps it for `u`, without a toast.
      remember(written.change, `Added ${quoted(text)}.`, { quiet: true, repo, subject: text });
    }, imagesOf(repo));
    if (done.ok) {
      added.set(`Added ${quoted(text)}${category === null ? "" : ` to ${category}`}.`);
    } else if (done.why !== null) {
      refusal.set(done.why);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <TextField
        autoFocus={props.focus}
        hint={added() ?? undefined}
        label="New note"
        lines="one"
        onBlur={() => {
          props.onFocused(false);
          added.set(null);
        }}
        onChange={(value) => {
          field.change(value);
          refusal.set(null);
          added.set(null);
        }}
        onEnter={() => void add()}
        onFocus={() => props.onFocused(true)}
        onSave={() => void add()}
        placeholder={
          props.category === null ? "Add a note: Enter adds it" : `Add a note to ${props.category}`
        }
        ref={props.ref}
        refusal={refusal()}
        testID="inbox-new-note"
        value={field.text()}
      />
      <If when={props.category}>
        {(name) => (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text size="under" tone="quiet">{`In ${name()}`}</Text>
            <IconButton
              icon="x"
              label="Add without a category"
              onPress={() => props.onCategory(null)}
            />
          </View>
        )}
      </If>
      <HeldImages
        images={images()}
        onRemove={(image) => release(props.repo, (one) => one !== image)}
      />
    </View>
  );
}
