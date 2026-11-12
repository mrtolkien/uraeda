// What an editor says when the file changed on disk while the human edited it, an agent's write
// or a pull: in place, over the text, which stays the human's. Three ways out, each deliberate:
// see what changed (the patch from the file to their text, which is what saving theirs would do),
// keep the file's version, or save theirs over it. The two that lose something ask first. Its
// keys, `v`, `F`, and `w`, are free in every pane that holds an editor: a buffer's, a proposal's,
// beside its nested lines' `d`, and a conflicted file's, beside its `t`.
import { signal, View } from "nsh";
import { Banner, Button, Confirm, lastAsked } from "../../ui/controls";
import type { Edited } from "./edited";

export type ChangedProps = {
  /** The file edited (`editedFile`): the banner shows while it changed under its text. */
  edited: Edited;
  /** The file's name: "spec.md". */
  name: string;
  /** Shows the patch, or the text again. */
  onShowsDiff: (shows: boolean) => void;
  /** Whether the patch is shown in place of the text. */
  showsDiff: boolean;
};

type Asking = "take" | "save" | null;

/** The banner and its ways out, while the file changed under the text: nothing otherwise. */
export function Changed(props: ChangedProps) {
  return (
    <If when={props.edited.changed()}>
      <Ways {...props} />
    </If>
  );
}

function Ways(props: ChangedProps) {
  const asking = signal<Asking>(null);
  const asked = lastAsked(asking);
  const answer = () => {
    const what = asking();
    props.onShowsDiff(false);
    if (what === "take") props.edited.takeFile();
    if (what === "save") void props.edited.saveOver();
  };
  return (
    <>
      <View style={{ gap: 6 }}>
        <Banner
          testID="buffer-changed"
          title={`${props.name} changed on disk since you began editing it`}
          tone="caution"
        >
          Your text is kept here, not saved. See what changed, then keep the file's version or save
          yours over it.
        </Banner>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Button
            icon="git-compare"
            keys="v"
            label={props.showsDiff ? "Back to your text" : "See what changed"}
            onPress={() => props.onShowsDiff(!props.showsDiff)}
            selected={props.showsDiff}
          />
          <Button
            icon="undo-2"
            keys="F"
            label="Take the file's version…"
            onPress={() => asking.set("take")}
          />
          <Button
            icon="save"
            keys="w"
            label="Save yours over it…"
            onPress={() => asking.set("save")}
          />
        </View>
      </View>
      <Confirm
        danger
        keep="Keep editing"
        keys={asked() === "take" ? "F" : "w"}
        label={asked() === "take" ? "Drop my text" : "Save over it"}
        onClose={() => asking.set(null)}
        onConfirm={answer}
        open={asking() !== null}
        title={asked() === "take" ? `Drop your text of ${props.name}?` : `Save over ${props.name}?`}
        words={
          asked() === "take"
            ? "Your unsaved text is lost, and the file's version shows. Copy what you need first."
            : "What changed on disk since you began is lost, unless it was committed."
        }
      />
    </>
  );
}
