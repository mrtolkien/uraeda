// A category's name, asked in a dialog: a new category's, or a new name for one. Enter saves, as
// a one-line field's; a refusal stays under the field, with the dialog open.
import { signal, View } from "nsh";
import { Button } from "../../ui/controls";
import { Dialog } from "../../ui/surfaces";
import { TextField } from "../../ui/text";

export function CategoryDialog(props: {
  initial: string;
  onClose: () => void;
  /** Saves the name typed: rejects with the words to show under the field. */
  onSave: (name: string) => Promise<void>;
  title: string;
}) {
  const name = signal(props.initial);
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const save = async () => {
    const typed = name().trim();
    if (typed === "") {
      refusal.set("A category needs a name.");
      return;
    }
    if (typed === props.initial) {
      props.onClose();
      return;
    }
    pending.set(true);
    try {
      await props.onSave(typed);
      props.onClose();
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <Dialog icon="folder-plus" onClose={props.onClose} title={props.title} width={420}>
      <TextField
        autoFocus
        first
        label="Category"
        lines="one"
        onChange={(value) => {
          name.set(value);
          refusal.set(null);
        }}
        onEnter={() => void save()}
        onSave={() => void save()}
        placeholder="UI, CLI, Ideas…"
        refusal={refusal()}
        value={name()}
      />
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <Button label="Cancel" onPress={props.onClose} />
        <Button
          icon="check"
          label="Save"
          onPress={() => void save()}
          pending={pending()}
          variant="main"
        />
      </View>
    </Dialog>
  );
}
