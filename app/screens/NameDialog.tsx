// A name, asked in a dialog: a new category's, or a new name for a category, a session, or a
// feature. Enter saves, as a one-line field's: a name commits nothing and spends no agent's time.
// A refusal stays under the field, with the dialog open; the same name closes it, saving nothing.
import { signal, View } from "nsh";
import { Button, type IconName } from "../ui/controls";
import { Dialog } from "../ui/surfaces";
import { TextField } from "../ui/text";

export function NameDialog(props: {
  icon: IconName;
  initial: string;
  /** The field's label: "Category", "Name". */
  label: string;
  onClose: () => void;
  /** Saves the name typed, trimmed: rejects with the words to show under the field. */
  onSave: (name: string) => Promise<void>;
  placeholder?: string;
  title: string;
  /** What a blank name is told, when it is refused here: a blank is saved otherwise. */
  blank?: string;
  /** A line under the field: what the name is for, and what a blank does. */
  words?: string;
}) {
  const name = signal(props.initial);
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const save = async () => {
    const typed = name().trim();
    if (typed === "" && props.blank !== undefined) {
      refusal.set(props.blank);
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
    <Dialog icon={props.icon} onClose={props.onClose} title={props.title} width={420}>
      <TextField
        autoFocus
        first
        hint={props.words}
        label={props.label}
        lines="one"
        onChange={(value) => {
          name.set(value);
          refusal.set(null);
        }}
        onEnter={() => void save()}
        onSave={() => void save()}
        placeholder={props.placeholder}
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
