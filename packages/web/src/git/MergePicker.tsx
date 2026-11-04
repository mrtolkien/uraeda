// "Merge into main…": the key picker over the branches a merge may bring in, the other local ones,
// then `origin`'s, as the page's view lists them; a pick merges it into the checked-out branch.
// The phone's sheet on narrow screens, as every picker.
import { KeyPicker } from "../keys/KeyPicker.tsx";
import type { PickerItem } from "../keys/pickerSources.ts";

/** A branch as the picker lists it, previewed by what a pick does. */
const itemOf = (branch: string, into: string): PickerItem => ({
  icon: "uraeda:git-branch",
  id: branch,
  kind: "changes",
  path: "",
  preview: `Merges ${branch} into ${into}.`,
  title: branch,
});

export function MergePicker({
  branches,
  into,
  isOpen,
  onClose,
  onPick,
}: {
  branches: ReadonlyArray<string>;
  into: string;
  isOpen: boolean;
  onClose: () => void;
  onPick: (branch: string) => void;
}) {
  return (
    <KeyPicker
      isOpen={isOpen}
      items={branches.map((branch) => itemOf(branch, into))}
      onClose={onClose}
      onPick={(item) => {
        onClose();
        onPick(item.id);
      }}
      placeholder="Find a branch…"
      title={`Merge into ${into}`}
    />
  );
}
