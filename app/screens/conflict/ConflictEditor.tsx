// A conflicted text file of a stopped pull or merge, in the app's text field, markers and all,
// shared by every place that shows one (the Git page's Diff pane). The human edits it to what it
// should be, or takes a side block by block from the bar over the field (`1` ours, `2` theirs, `3`
// both, `n` the next block), as typing would: the text stays unsaved until `Ctrl+Enter` or Save,
// once no marker is left. Or a side is taken whole (`o`, `t`), named by its branch. A save names
// the file as it was read, and is refused when it changed since, with the way out.
import { computed, signal, View } from "nsh";
import { conflictBlocks, takeConflict } from "uraeda/native";
import { call, pathOf, record, type StoreError } from "../../store";
import { Button, Refusal, Spinner, Text } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { TextField, type TextFieldRef, unsavedKey, unsavedText } from "../../ui/text";

/** Whether a text still holds one of git's conflict markers, at a line's start. */
const hasMarkers = (text: string) => /^(<<<<<<<|=======|>>>>>>>)( |$)/m.test(text);

type Side = "ours" | "theirs" | "both";

export function ConflictEditor(props: { path: string; repo: string }) {
  const pane = usePane();
  const file = record("ConflictFile", { path: props.path, repo: props.repo });
  const page = record("GitPage", { repo: props.repo });
  const stopped = () => page()?.stopped ?? null;
  const conflict = () => page()?.conflicts.find((one) => one.path === props.path);
  const text = unsavedText(
    unsavedKey(props.repo, `git#conflict:${props.path}`),
    () => file()?.text ?? "",
    { exact: true },
  );
  const blocks = computed(() => conflictBlocks(text.text()));
  // The block the bar acts on: kept in the visit, and never past the last one.
  const at = pane.remember("conflict", 0);
  const current = () => Math.min(at(), Math.max(0, blocks().length - 1));
  let field: TextFieldRef | undefined;

  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const write = async (name: "git.saveConflict" | "git.resolve", input: object, label: string) => {
    refusal.set(null);
    pending.set(true);
    const named = { ...input, write: { href: pathOf({ page: "git", repo: props.repo }), label } };
    try {
      await call(name, named as never);
      return true;
    } catch (error) {
      const words = (error as StoreError | undefined)?.message ?? String(error);
      refusal.set(words.trim() === "" ? "Git refused it, and said nothing more." : words.trim());
      return false;
    } finally {
      pending.set(false);
    }
  };
  const save = () => {
    const read = file();
    if (read === undefined || read === null || hasMarkers(text.text())) return;
    const { path, repo } = props;
    // The text as it is now: what is typed while it is saved stays, unsaved.
    void text.save(async (typed) => {
      const saving = { hash: read.hash, path, repo, text: typed };
      if (!(await write("git.saveConflict", saving, `Saving ${path}`))) {
        throw new Error("The save was refused.");
      }
    });
  };
  const takeWhole = (resolution: "ours" | "theirs") =>
    void write(
      "git.resolve",
      { path: props.path, repo: props.repo, resolution },
      `Taking ${resolution} for ${props.path}`,
    );
  /** Goes to block `index`, its marker's line in the middle of the field. */
  const goTo = (index: number) => {
    const block = blocks()[index];
    if (block === undefined) return false;
    at.set(index);
    field?.goToLine(block.line);
  };
  const take = (side: Side) => {
    const index = current();
    if (blocks()[index] === undefined) return;
    text.change(takeConflict(text.text(), index, side));
    // The next block takes the taken one's place in the list.
    setTimeout(() => goTo(Math.min(index, blocks().length - 1)), 0);
  };

  return (
    <View style={{ flex: 1, gap: 10 }}>
      {/* The words over the buttons, never in their row: a row that wraps measured the words at
          their whole length, and sent the last button under the others with room left. */}
      <View>
        <Text font="code">{props.path}</Text>
        <Text size="under" tone="faint">
          {conflict()?.isResolved === true
            ? "Resolved: it waits for Continue."
            : hasMarkers(text.text())
              ? "Take a side block by block, edit it until no marker is left, or take a side whole."
              : "No marker is left: Ctrl+Enter saves it."}
        </Text>
      </View>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <If when={stopped()}>
          {(sides) => (
            <>
              <Button keys="o" label={`Take ${sides().ours}`} onPress={() => takeWhole("ours")} />
              <Button
                keys="t"
                label={`Take ${sides().theirs}`}
                onPress={() => takeWhole("theirs")}
              />
            </>
          )}
        </If>
        <Button
          disabled={hasMarkers(text.text()) || !text.dirty()}
          icon="save"
          label="Save"
          onPress={save}
          pending={pending()}
          variant="main"
        />
      </View>
      <If when={blocks().length > 0}>
        <View
          style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}
          testID="conflict-bar"
        >
          <Text tone="quiet">{`Conflict ${current() + 1} of ${blocks().length}`}</Text>
          <Button
            keys="1"
            label={`Use ${stopped()?.ours ?? "ours"}`}
            onPress={() => take("ours")}
          />
          <Button
            keys="2"
            label={`Use ${stopped()?.theirs ?? "theirs"}`}
            onPress={() => take("theirs")}
          />
          <Button keys="3" label="Use both" onPress={() => take("both")} />
          <Button
            icon="arrow-down"
            keys="n"
            label="Next conflict"
            onPress={() => goTo((current() + 1) % blocks().length)}
          />
        </View>
      </If>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      <If
        when={file()}
        else={
          <If when={file() === null} else={<Spinner label={`Reading ${props.path}`} />}>
            <Text tone="quiet">It is no longer conflicted: the Changes list has what is left.</Text>
          </If>
        }
      >
        <TextField
          label={`The text of ${props.path}`}
          language={props.path.endsWith(".md") ? undefined : props.path}
          normalFirst
          onChange={text.change}
          onSave={save}
          ref={(made) => {
            field = made;
          }}
          rows={{ min: 12 }}
          value={text.text()}
        />
      </If>
    </View>
  );
}
