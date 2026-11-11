// A conflicted text file of a stopped pull or merge, in the app's text field, markers and all:
// the human edits it to what it should be, and saves it with `Ctrl+Enter` or Save once no marker
// is left; or takes a side whole, named by its branch. A save names the file as it was read, and
// is refused when it changed since, with the way out.
import { View } from "nsh";
import { gitPage } from "./Sync";
import { isPending, refusalAt, write } from "./writes";
import { record } from "../../store";
import { Button, Refusal, Spinner, Text } from "../../ui/controls";
import { TextField, unsavedKey, unsavedText } from "../../ui/text";

/** Whether a text still holds one of git's conflict markers, at a line's start. */
const hasMarkers = (text: string) => /^(<<<<<<<|=======|>>>>>>>)( |$)/m.test(text);

export function ConflictEditor(props: { path: string; repo: string }) {
  const file = record("ConflictFile", { path: props.path, repo: props.repo });
  const stopped = () => gitPage(props.repo)()?.stopped ?? null;
  const conflict = () => gitPage(props.repo)()?.conflicts.find((one) => one.path === props.path);
  const text = unsavedText(
    unsavedKey(props.repo, `git#conflict:${props.path}`),
    () => file()?.text ?? "",
    { exact: true },
  );
  const where = `${props.repo}/conflict:${props.path}`;
  const save = () => {
    const read = file();
    if (read === undefined || read === null || hasMarkers(text.text())) return;
    const saving = { hash: read.hash, path: props.path, repo: props.repo, text: text.text() };
    void write(where, "git.saveConflict", saving, `Saving ${props.path}`).then((done) => {
      if (done) text.saved(saving.text);
    });
  };
  const take = (resolution: "ours" | "theirs") =>
    void write(
      where,
      "git.resolve",
      { path: props.path, repo: props.repo, resolution },
      `Taking ${resolution} for ${props.path}`,
    );
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text font="code">{props.path}</Text>
          <Text size="under" tone="faint">
            {conflict()?.isResolved === true
              ? "Resolved: it waits for Continue."
              : hasMarkers(text.text())
                ? "Edit it until no marker is left, or take a side whole."
                : "No marker is left: Ctrl+Enter saves it."}
          </Text>
        </View>
        <If when={stopped()}>
          {(sides) => (
            <>
              <Button keys="o" label={`Take ${sides().ours}`} onPress={() => take("ours")} />
              <Button keys="t" label={`Take ${sides().theirs}`} onPress={() => take("theirs")} />
            </>
          )}
        </If>
        <Button
          disabled={hasMarkers(text.text()) || !text.dirty()}
          icon="save"
          label="Save"
          onPress={save}
          pending={isPending(where)}
          variant="main"
        />
      </View>
      <If when={refusalAt(where)}>{(words) => <Refusal words={words()} />}</If>
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
          normalFirst
          onChange={text.change}
          onSave={save}
          rows={{ min: 12 }}
          value={text.text()}
        />
      </If>
    </View>
  );
}
