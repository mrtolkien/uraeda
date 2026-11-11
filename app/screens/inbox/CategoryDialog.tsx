// A category's name, asked in the app's one name dialog: a new category's, or a new name for one.
import { NameDialog } from "../NameDialog";

export function CategoryDialog(props: {
  initial: string;
  onClose: () => void;
  /** Saves the name typed: rejects with the words to show under the field. */
  onSave: (name: string) => Promise<void>;
  title: string;
}) {
  return (
    <NameDialog
      blank="A category needs a name."
      icon="folder-plus"
      initial={props.initial}
      label="Category"
      onClose={props.onClose}
      onSave={props.onSave}
      placeholder="UI, CLI, Ideas…"
      title={props.title}
    />
  );
}
