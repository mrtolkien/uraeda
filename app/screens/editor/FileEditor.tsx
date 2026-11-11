// A file edited whole, frontmatter and all, in the app's one text field: a buffer (`/buffer/<path>`)
// or a workflow file's source (`/edit/<path>`). The text typed is kept on the device as it is
// typed, and comes back; `Ctrl+Enter` or `:w` saves it on the file's branch, never committing, over
// the version it was typed over, so a file changed on disk meanwhile is never overwritten silently:
// the editor says so in place, and keeps the text. While nothing is typed, it follows the disk.
// Any other text file of the repository, code, is highlighted in its language, and only read.
import { type Accessor, computed, effect, signal, untracked, View } from "nsh";
import { Changed } from "./Changed";
import { trackDisk } from "./disk";
import { FileDiff } from "./FileDiff";
import { lineAsked } from "./jump";
import { Where } from "./Where";
import { call, record } from "../../store";
import type { Buffer } from "../../store/protocol";
import { Banner, Button, Spinner } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import {
  SaveStatus,
  saving,
  TextField,
  type TextFieldRef,
  unsavedKey,
  unsavedText,
  vimMode,
} from "../../ui/text";
import { tokens } from "../../ui/tokens";

export type FileEditorProps = {
  /** Leaves the editor: back to the page it was opened from. */
  onLeave: () => void;
  /** Whether a save leaves too, as a workflow file's source returns to its page. */
  leavesOnSave: boolean;
  path: string;
  repo: string;
};

/** The file's name, as the words about it say it: "spec.md". */
const nameOf = (path: string) => path.split("/").pop() ?? path;

/** The key of a file's unsaved text, and of the outline's jumps to its lines. */
export const bufferKey = (repo: string, path: string) => unsavedKey(repo, `${path}#buffer`);

export function FileEditor(props: FileEditorProps) {
  const buffer = record("Buffer", { path: props.path, repo: props.repo });
  return (
    <If
      when={buffer.error()}
      else={
        <If when={buffer()} else={<Spinner label={`Reading ${props.path}`} />}>
          {(read) => <Editing {...props} buffer={read} />}
        </If>
      }
    >
      {(error) => (
        <Empty icon="file-text" title={`${props.path} cannot be opened`} words={error().message} />
      )}
    </If>
  );
}

function Editing(props: FileEditorProps & { buffer: Accessor<Buffer> }) {
  const pane = usePane();
  const name = nameOf(props.path);
  const tracked = trackDisk(props.buffer);
  const disk = tracked.disk;
  const text = unsavedText(bufferKey(props.repo, props.path), () => disk().text, { exact: true });
  const readOnly = () => props.buffer().readOnly;
  // The file changed under the text typed: the text was typed over another version than the disk's.
  const changed = () => {
    const typed = text.entry();
    return typed !== undefined && text.dirty() && typed.base !== disk().text;
  };
  const showsDiff = pane.remember("diff", false);
  let field: TextFieldRef | undefined;

  // `over`: the human chose to save over the file as it is now, after it changed.
  let over = false;
  const saves = saving(async (value) => {
    const from = untracked(disk);
    if (!over && untracked(changed)) {
      throw new Error(`${name} changed on disk: see what changed, then take a version.`);
    }
    over = false;
    const input = { hash: from.hash, path: props.path, repo: props.repo, text: value };
    const answer = await call("buffer.save", input);
    tracked.saved(from.hash, { hash: answer.hash, text: value });
    text.saved(value);
  });
  // The save on its way, which `:wq`'s quit waits for: a refused one keeps the text unsaved, which
  // the leave guard then asks about.
  let inFlight: Promise<boolean> = Promise.resolve(true);
  const save = async () => {
    if (readOnly() !== null || !text.dirty()) return;
    inFlight = saves.save(text.text());
    if ((await inFlight) && props.leavesOnSave) props.onLeave();
  };
  const quit = () => void inFlight.then(() => props.onLeave());
  const saveMine = () => {
    over = true;
    showsDiff.set(false);
    void save();
  };
  const takeFile = () => {
    showsDiff.set(false);
    text.discard();
  };

  // The outline's heading, asked from the side stack: the caret goes to its line.
  effect(() => {
    const asked = lineAsked();
    if (asked?.key !== bufferKey(props.repo, props.path)) return;
    showsDiff.set(false);
    setTimeout(() => field?.goToLine(asked.line), 0);
  });

  // The rows the field takes: the room the pane gives it, so the text scrolls in the field, where
  // Vim's motions keep the caret in view.
  const room = signal(0);
  const rows = () => Math.max(6, Math.floor((room() - 8) / tokens.type.line));

  registerKey([
    {
      hint: "⏎ i",
      hintLabel: "edit",
      keys: "Enter",
      label: "Edit the text",
      run: () => field?.resume(),
    },
    { keys: "i", label: "Edit the text", run: () => field?.resume() },
    { hint: "esc", hintLabel: "back", keys: "Escape", label: "Back", run: props.onLeave },
  ]);
  // Save works, and is hinted, while there is something to save; its hint follows Vim's setting.
  const canSave = computed(() => readOnly() === null && text.dirty() && !changed());
  effect(() => {
    registerKey({
      hint: vimMode() ? ":w" : "⌃⏎",
      keys: "mod+Enter",
      label: "Save",
      run: () => void save(),
      when: canSave,
    });
  });

  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Where buffer={props.buffer()} dirty={text.dirty()} />
        <If when={readOnly() === null}>
          <>
            <SaveStatus dirty={text.dirty()} state={saves.state()} testID="buffer-save-status" />
            <Button
              disabled={!text.dirty() || changed()}
              icon="save"
              label="Save"
              onPress={() => void save()}
              pending={saves.state().kind === "saving"}
              variant="main"
            />
          </>
        </If>
      </View>
      <If when={readOnly()}>
        {(why) => (
          <Banner icon="file-text" title="Only read here">
            {why()}
          </Banner>
        )}
      </If>
      <If when={changed()}>
        <Changed
          name={name}
          onSaveMine={saveMine}
          onTakeFile={takeFile}
          onToggleDiff={() => showsDiff.set(!showsDiff())}
          showsDiff={showsDiff()}
        />
      </If>
      <View onLayout={(event) => room.set(event.bounds.size.height)} style={{ flex: 1 }}>
        <If
          when={changed() && showsDiff()}
          else={
            <TextField
              label={`The text of ${props.path}`}
              language={props.path.endsWith(".md") ? undefined : props.path}
              normalFirst
              onChange={text.change}
              onQuit={quit}
              onSave={() => void save()}
              readOnly={readOnly() !== null}
              ref={(made) => {
                field = made;
                // A file opens as Vim opens one: the caret at its start, ready to type.
                if (readOnly() === null) setTimeout(() => made.goToLine(0), 0);
              }}
              refusal={saves.refusal()}
              rows={{ max: rows(), min: rows() }}
              testID="buffer-text"
              value={text.text()}
            />
          }
        >
          <FileDiff mine={text.text()} on={disk().text} path={props.path} />
        </If>
      </View>
    </View>
  );
}
