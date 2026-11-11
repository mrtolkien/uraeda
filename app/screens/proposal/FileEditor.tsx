// A proposal file's text, in the app's one text field: Ctrl+Enter or `:w` saves it over the version
// it was read at, its unsaved text kept on the device until then, so leaving asks first and the
// text comes back (`LeaveGuard`). Its research effort, its images by picker, paste, and drop, each
// attached to the file and linked where the caret is, then its start. A save refused, as when the
// file changed elsewhere, says why under the field, with the way to load the new version.
import { Clipboard, signal, View } from "nsh";
import { call, record } from "../../store";
import type { ProposalFileView } from "../../store/protocol";
import { Banner, Button, IconButton, Segmented, sent, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import {
  SaveStatus,
  saving,
  TextField,
  type TextFieldRef,
  unsavedKey,
  unsavedText,
  writeUnsaved,
} from "../../ui/text";
import { attachToFile, droppedImages, type Held, pastedImage, pickImages } from "../images";
import type { Started } from "../new/Landing";
import { StartPart } from "./StartPart";

/** A level as the control shows it: `medium` is Medium. */
const levelLabel = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

type EditorProps = {
  repo: string;
  proposalKey: string;
  file: () => ProposalFileView;
  onStarted: (started: Started) => void;
};

function Editor(props: EditorProps) {
  const path = () => props.file().path;
  const field = unsavedText(unsavedKey(props.repo, path()), () => props.file().text);
  const saves = saving(async (text) => {
    await call("text.save", { hash: props.file().hash, path: path(), repo: props.repo, text });
    field.saved(text);
  });
  const said = signal<string | null>(null);
  const typing = signal(false);
  let editor: TextFieldRef | undefined;
  /** Saves what was typed, if anything: says whether the text is saved. */
  const save = () => (field.dirty() ? saves.save(field.text()) : Promise.resolve(true));
  const effort = sent(
    () => props.file().discovery ?? "high",
    async (level: string) => {
      if (!(await save()))
        throw new Error("Your text is not saved: the research effort was not set.");
      await call("text.discovery", {
        hash: props.file().hash,
        level,
        path: path(),
        repo: props.repo,
      });
    },
  );
  /** Attaches images to the file, each linked where the caret is. */
  const attach = async (images: ReadonlyArray<Held>) => {
    for (const image of images) {
      // One after the other: the first image may move the file, which the next is attached to.
      // oxlint-disable-next-line no-await-in-loop
      const answer = await attachToFile(props.repo, path(), image);
      editor?.insert(`\n${answer.link}\n`);
      // A proposal file with its first image becomes a folder: its text follows it there.
      if (answer.path !== path()) {
        writeUnsaved(unsavedKey(props.repo, answer.path), {
          at: new Date().toISOString(),
          base: props.file().text,
          text: field.text(),
        });
      }
    }
  };
  const run = (work: () => Promise<unknown>) => {
    said.set(null);
    work().catch((error: Error) => said.set(error.message));
  };
  registerKey([
    { hint: "i", keys: "i", label: "Edit the text", run: () => editor?.focus() },
    {
      inField: true,
      keys: "mod+v",
      label: "Paste, an image into the proposal",
      run: () =>
        run(async () => {
          const image = await pastedImage();
          if (image !== undefined) await attach([image]);
          else if (typing()) editor?.insert(await Clipboard.readText());
        }),
    },
  ]);
  return (
    <View
      onFileDrop={(event) => run(async () => attach(await droppedImages(event.uris)))}
      style={{ gap: 14 }}
    >
      <If when={props.file().kind === "proposal-file" && props.file().discoveryLevels.length > 0}>
        <View style={{ gap: 6 }}>
          <Text tone="quiet">Research effort, before the spec</Text>
          <Segmented
            label="Research effort"
            onChange={effort.set}
            options={props
              .file()
              .discoveryLevels.map((one) => ({ label: levelLabel(one), value: one }))}
            pending={effort.pending()}
            refusal={effort.refusal()}
            value={effort.value()}
          />
        </View>
      </If>
      <TextField
        hint="Ctrl+Enter saves it."
        label="The proposal"
        onBlur={() => typing.set(false)}
        onChange={(value) => {
          field.change(value);
          said.set(null);
        }}
        onFocus={() => typing.set(true)}
        onSave={() => void save()}
        ref={(made) => {
          editor = made;
        }}
        refusal={saves.refusal() ?? said()}
        rows={{ max: 40, min: 10 }}
        testID="proposal-text"
        value={field.text()}
      />
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <If when={field.dirty()}>
          <Button icon="save" label="Save" onPress={() => void save()} />
        </If>
        <IconButton
          icon="image-plus"
          label="Add images"
          onPress={() => run(async () => attach(await pickImages()))}
        />
        <Text size="under" tone="faint">
          {props.file().committed ? "Committed" : "Not committed: its start commits it"}
        </Text>
        <SaveStatus dirty={field.dirty()} state={saves.state()} testID="proposal-save" />
        <If when={field.dirty() && saves.refusal() !== null}>
          <Button icon="undo-2" label="Load the saved version" onPress={field.discard} />
        </If>
      </View>
      <If when={props.file().kind === "proposal-file"}>
        <StartPart
          file={props.file()}
          onStarted={props.onStarted}
          proposalKey={props.proposalKey}
          repo={props.repo}
          save={save}
        />
      </If>
    </View>
  );
}

/** The file at `path`, once read: its editor, or why it could not be read. */
export function FileEditor(props: Omit<EditorProps, "file"> & { path: string }) {
  const file = record("ProposalFile", { id: props.path, repo: props.repo });
  return (
    <If
      when={file.error()}
      else={
        <If when={file()} else={<Spinner label="Reading the proposal's file" />}>
          {(shown) => (
            <Editor
              file={shown}
              onStarted={props.onStarted}
              proposalKey={props.proposalKey}
              repo={props.repo}
            />
          )}
        </If>
      }
    >
      {(error) => (
        <Banner tone="danger" title={`${props.path} could not be read`}>
          {error().message}
        </Banner>
      )}
    </If>
  );
}
