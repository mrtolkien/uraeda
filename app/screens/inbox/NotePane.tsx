// A note's own pane, `/inbox/<key>`: its text in the app's text field, Enter or Ctrl+Enter saving
// it, its sub-items, its images, and what it can become: moved to a category, made a proposal, or
// deleted, at once, with Undo. A note that leaves the inbox leaves its pane saying where it went,
// with Undo and the way back to the list.
import { Clipboard, effect, Image, signal, View } from "nsh";
import { call, imageOf, navigate, record, redirect } from "../../store";
import type { Inbox, InboxNote } from "../../store/protocol";
import { Button, Heading, IconButton, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { PaneScroll } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";
import { deleteNote } from "./actions";
import { droppedImages, type Held, pastedImage, pickImages } from "../images";
import { sendImages } from "./images";
import { noteOf, plain, quoted } from "./model";
import { remember } from "../shell/undoStack";
import { NotePicker, type Picking } from "./Pickers";

/** A note saved under a new text has a new key: its pane follows it there, by its id. */
const renamed = signal<{ from: string; id: string } | null>(null);

/** The note's images, each drawn from the server, with the way to take it out of its file. */
function Images(props: { note: InboxNote; repo: string; onRefused: (words: string) => void }) {
  const file = () => props.note.file;
  return (
    <If when={file() !== null && props.note.images.length > 0}>
      <ImageRow file={file()!} note={props.note} onRefused={props.onRefused} repo={props.repo} />
    </If>
  );
}

function ImageRow(props: {
  file: string;
  note: InboxNote;
  repo: string;
  onRefused: (words: string) => void;
}) {
  const held = record("ProposalFile", { id: props.file, repo: props.repo });
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <Each of={props.note.images}>
        {(path) => (
          <View style={{ gap: 4, maxWidth: 240 }}>
            <If when={imageOf(props.repo, path())()} else={<Spinner label="Reading the image" />}>
              {(src) => (
                <Image
                  accessibilityLabel={path().split("/").pop() ?? path()}
                  src={src()}
                  style={{ height: 160, objectFit: "contain", width: 240 }}
                />
              )}
            </If>
            <Button
              icon="trash-2"
              label="Take it out"
              onPress={() =>
                call("inbox.removeImage", {
                  file: props.file,
                  hash: held()?.hash ?? "",
                  image: path(),
                  repo: props.repo,
                })
                  .then((written) =>
                    remember(written.change, "Removed an image of the note.", {
                      repo: props.repo,
                    }),
                  )
                  .catch((error: Error) => props.onRefused(error.message))
              }
            />
          </View>
        )}
      </Each>
    </View>
  );
}

// oxlint-disable-next-line max-lines-per-function -- the note's saved text, its triage, and its actions share one state; the actions' row can be a component
function Note(props: { category: string | null; inbox: Inbox; note: InboxNote; repo: string }) {
  const field = unsavedText(
    unsavedKey(props.repo, `specs/INBOX.md#${props.note.key}`),
    () => props.note.text,
  );
  const refusal = signal<string | null>(null);
  const saved = signal(false);
  const picking = signal<Picking | null>(null);
  const typing = signal(false);
  let editor: TextFieldRef | undefined;
  const said = (run: () => Promise<unknown>) => {
    refusal.set(null);
    run().catch((error: Error) => refusal.set(error.message));
  };
  const save = () =>
    said(async () => {
      if (field.text().trim() === props.note.text) return;
      const { repo } = props;
      const [hash, note] = [props.inbox.hash, props.note];
      renamed.set({ from: note.key, id: note.id });
      // The text as it is now: what is typed while it is saved stays, unsaved.
      const done = await field.save(async (typed) => {
        const text = typed.trim();
        const written = await call("inbox.edit", { hash, note: note.id, repo, text });
        // The field says it was saved: the stack keeps it for `u`, without a toast.
        remember(written.change, `Edited ${quoted(text)}.`, { quiet: true, repo, subject: text });
      });
      if (!done.ok) throw new Error(done.why ?? "");
      saved.set(true);
    });
  const attach = (images: ReadonlyArray<Held>) =>
    images.length === 0
      ? Promise.resolve()
      : sendImages(props.repo, props.inbox.hash, { id: props.note.id }, images);
  const pick = (kind: Picking["kind"]) =>
    picking.set({ category: props.category, kind, note: props.note });
  // The pane then says it is gone, with Undo, as after any move out of the inbox.
  const remove = () => said(() => deleteNote(props.repo, props.inbox, props.note));
  // `c`, `p`, and `d` are its buttons' own keys; `i` edits its text, as everywhere else.
  registerKey([
    {
      hint: "i",
      hintLabel: "edit",
      icon: "pencil",
      keys: "i",
      label: "Edit the note",
      run: () => (editor === undefined ? false : void editor.focus()),
    },
    {
      // In its field too: an image is added to the note, and text goes in the field.
      inField: true,
      keys: "mod+v",
      label: "Paste, an image into the note",
      run: () =>
        said(async () => {
          const image = await pastedImage();
          if (image !== undefined) await attach([image]);
          else if (typing()) editor?.insert(await Clipboard.readText());
        }),
    },
  ]);
  return (
    <View
      onFileDrop={(event) => said(async () => attach(await droppedImages(event.uris)))}
      style={{ flex: 1 }}
    >
      <PaneScroll style={{ flex: 1 }}>
        <View style={{ gap: 14, paddingBottom: 24 }}>
          <Text tone="quiet">
            {[
              props.category ?? "No category",
              ...(props.note.agent ? ["written by an agent"] : []),
              ...(props.note.about === null ? [] : [`about ${props.note.about}`]),
            ].join(" · ")}
          </Text>
          <If
            when={props.note.file}
            else={
              <TextField
                hint={
                  field.dirty()
                    ? "Enter saves it"
                    : saved()
                      ? "Saved: the Git page commits it"
                      : undefined
                }
                label="The note"
                lines="one"
                onBlur={() => typing.set(false)}
                onFocus={() => typing.set(true)}
                ref={(made) => {
                  editor = made;
                }}
                onChange={(value) => {
                  field.change(value);
                  saved.set(false);
                  refusal.set(null);
                }}
                onEnter={save}
                onSave={save}
                refusal={refusal()}
                value={field.text()}
              />
            }
          >
            {(file) => (
              <View style={{ alignItems: "flex-start", gap: 8 }}>
                <Heading level={2}>{plain(props.note.spans) || props.note.text}</Heading>
                <Button
                  icon="file-pen-line"
                  label="Open its note file"
                  onPress={() => navigate({ page: "edit", path: file(), repo: props.repo })}
                />
              </View>
            )}
          </If>
          <If when={props.note.nestedSpans.length > 0}>
            <View style={{ gap: 4 }}>
              <Each of={props.note.nestedSpans}>
                {(spans) => <Text>{`• ${plain(spans())}`}</Text>}
              </Each>
            </View>
          </If>
          <Images note={props.note} onRefused={(words) => refusal.set(words)} repo={props.repo} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button
              icon="folder"
              keys="c"
              label="Move to a category"
              onPress={() => pick("move")}
            />
            <Button
              icon="flag"
              keys="p"
              label="Make it a proposal"
              onPress={() => pick("promote")}
            />
            <IconButton
              icon="image-plus"
              label="Add images"
              onPress={() => said(async () => attach(await pickImages()))}
            />
            <Button icon="trash-2" keys="d" label="Delete" onPress={remove} variant="danger" />
          </View>
          <If when={props.note.file === null ? null : refusal()}>
            {(words) => <Text tone="danger">{words()}</Text>}
          </If>
        </View>
      </PaneScroll>
      <If when={picking()}>
        {(shown) => (
          <NotePicker
            inbox={props.inbox}
            onClose={() => picking.set(null)}
            onRefused={(words) => refusal.set(words)}
            picking={shown()}
            repo={props.repo}
          />
        )}
      </If>
    </View>
  );
}

/** A note gone from the inbox: the way back to the list; the undo toast says where it went. */
function Gone(props: { repo: string }) {
  return (
    <View style={{ gap: 12 }}>
      <Empty
        action={{
          icon: "inbox",
          label: "Open the inbox",
          run: () => redirect({ page: "inbox", repo: props.repo }),
        }}
        icon="inbox"
        title="This note is no longer in the inbox"
        words="It was moved, made a proposal, or deleted, here or in INBOX.md."
      />
    </View>
  );
}

/** The note's pane: the note once the inbox is read, following it under a new key. */
export function NoteView(props: { noteKey: string; repo: string }) {
  const inbox = record("Inbox", { repo: props.repo });
  const found = () => noteOf(inbox(), props.noteKey);
  const followed = () => {
    const was = renamed();
    if (found() !== undefined || was?.from !== props.noteKey) return undefined;
    return inbox()
      ?.categories.flatMap((one) => one.notes)
      .find((note) => note.id === was.id);
  };
  effect(() => {
    const note = followed();
    if (note === undefined) return;
    renamed.set(null);
    redirect({ key: note.key, page: "note", repo: props.repo });
  });
  return (
    <If when={inbox()} else={<Spinner label="Reading the inbox" />}>
      {(shown) => (
        <If
          when={found()}
          else={
            <If when={followed()} else={<Gone repo={props.repo} />}>
              <Spinner label="Following the note" />
            </If>
          }
        >
          {(here) => (
            <Note category={here().category} inbox={shown()} note={here().note} repo={props.repo} />
          )}
        </If>
      )}
    </If>
  );
}
