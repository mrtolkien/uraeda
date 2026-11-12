// A proposal file's text, in the app's one text field: Ctrl+Enter or `:w` saves it over the version
// it was typed over, its unsaved text kept on the device until then, so leaving asks first and the
// text comes back (`LeaveGuard`). A file changed on disk meanwhile, by an agent or a pull, is never
// overwritten silently: the editor says so over the field, keeps the text, and gives the ways out,
// as a buffer does (`editedFile`). Its research effort, its images by picker, paste, and drop, each
// attached to the file and linked where the caret is, then its start.
import { Clipboard, signal, View } from "nsh";
import { call, record } from "../../store";
import type { ProposalFileView } from "../../store/protocol";
import { Banner, Button, IconButton, Segmented, sent, Spinner, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { moveUnsaved, SaveStatus, TextField, type TextFieldRef, unsavedKey } from "../../ui/text";
import { isNarrow } from "../../ui/width";
import { Changed } from "../editor/Changed";
import { editedFile } from "../editor/edited";
import { FileDiff } from "../editor/FileDiff";
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
  const name = () => path().split("/").pop() ?? path();
  const edited = editedFile({
    key: () => unsavedKey(props.repo, path()),
    name,
    read: () => ({ hash: props.file().hash, text: props.file().text }),
    send: (text, hash) => call("text.save", { hash, path: path(), repo: props.repo, text }),
  });
  const { saves, text: field } = edited;
  const showsDiff = signal(false);
  const said = signal<string | null>(null);
  const typing = signal(false);
  let editor: TextFieldRef | undefined;
  /** Saves what was typed, if anything: says whether the text is saved. */
  const save = () => (field.dirty() ? edited.save() : Promise.resolve(true));
  const effort = sent(
    () => props.file().discovery ?? "high",
    async (level: string) => {
      if (!(await save()))
        throw new Error("Your text is not saved: the research effort was not set.");
      await call("text.discovery", {
        hash: edited.disk().hash,
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
        moveUnsaved(unsavedKey(props.repo, path()), unsavedKey(props.repo, answer.path));
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
      <Changed edited={edited} name={name()} onShowsDiff={showsDiff.set} showsDiff={showsDiff()} />
      <If
        when={edited.changed() && showsDiff()}
        else={
          <TextField
            hint={isNarrow() ? undefined : "Ctrl+Enter saves it."}
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
        }
      >
        <View style={{ height: 420 }}>
          <FileDiff mine={field.text()} on={edited.disk().text} path={path()} />
        </View>
      </If>
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
