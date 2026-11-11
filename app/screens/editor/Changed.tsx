// What an editor says when the file changed on disk while the human edited it, an agent's write
// or a pull: in place, over the text, which stays the human's. Three ways out, each deliberate:
// see what changed (the patch from the file to their text, which is what saving theirs would do),
// keep the file's version, or save theirs over it. The two that lose something ask first.
import { signal, View } from "nsh";
import { Button, Text } from "../../ui/controls";
import { Banner } from "../../ui/controls";
import { Dialog } from "../../ui/surfaces";

export type ChangedProps = {
  /** The file's name: "spec.md". */
  name: string;
  /** Drops the human's text: the file's version shows. */
  onTakeFile: () => void;
  /** Saves the human's text over the file as it is now. */
  onSaveMine: () => void;
  /** Shows the patch, or the text again. */
  onToggleDiff: () => void;
  /** Whether the patch is shown in place of the text. */
  showsDiff: boolean;
};

type Asking = "take" | "save" | null;

export function Changed(props: ChangedProps) {
  const asking = signal<Asking>(null);
  const answer = (yes: boolean) => {
    const asked = asking();
    asking.set(null);
    if (yes && asked === "take") props.onTakeFile();
    if (yes && asked === "save") props.onSaveMine();
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
            keys="d"
            label={props.showsDiff ? "Back to your text" : "See what changed"}
            onPress={props.onToggleDiff}
            selected={props.showsDiff}
          />
          <Button
            icon="undo-2"
            keys="t"
            label="Take the file's version"
            onPress={() => asking.set("take")}
          />
          <Button
            icon="save"
            keys="w"
            label="Save yours over it"
            onPress={() => asking.set("save")}
          />
        </View>
      </View>
      <Dialog
        onClose={() => answer(false)}
        open={asking() !== null}
        title={asking() === "take" ? "Drop your text?" : "Save over the file?"}
      >
        <Text>
          {asking() === "take"
            ? "Your unsaved text is lost, and the file's version shows. Copy what you need first."
            : "What changed on disk since you began is lost, unless it was committed."}
        </Text>
        <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
          <Button label="Keep editing" onPress={() => answer(false)} />
          <Button
            label={asking() === "take" ? "Drop my text" : "Save over it"}
            onPress={() => answer(true)}
            variant="danger"
          />
        </View>
      </Dialog>
    </>
  );
}
