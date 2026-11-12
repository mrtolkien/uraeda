// A file's text, edited over the version it was read at: the one home of every editor of a file,
// a buffer's, a proposal's, a conflicted file's. The text typed is kept on the device as it is
// typed; a save names the version the text was typed over, so a file changed on disk meanwhile,
// by an agent's write, a pull, another device's save, is never overwritten silently: the save is
// refused in place, the text stays, and `Changed` gives the three ways out, see what changed, take
// the file's version, or save over it. While nothing is typed, the editor follows the disk.
import { type Accessor, untracked } from "nsh";
import { type Saving, saving, unsavedText, type UnsavedText } from "../../ui/text";
import { type Disk, trackDisk } from "./disk";

export type Edited = {
  /** Whether the file changed under the text typed: it was typed over another version. */
  changed: Accessor<boolean>;
  /** The file as it is on disk now. */
  disk: Accessor<Disk>;
  /** Saves the text as it is now, over the version it was typed over: says whether it was saved. */
  save: () => Promise<boolean>;
  /** Saves the text over the file as it is now, after it changed: the human chose to. */
  saveOver: () => Promise<boolean>;
  /** The saves' state, for `SaveStatus`, and the refusal for under the field. */
  saves: Saving;
  /** Drops the text typed: the file's version shows. */
  takeFile: () => void;
  /** The field's text. */
  text: UnsavedText;
};

export function editedFile(of: {
  /** Whether blanks at the text's ends are an edit, as in a whole file. */
  exact?: boolean;
  /** The key the device keeps the unsaved text under. */
  key: string | Accessor<string>;
  /** The file's name, as the refusal says it: "spec.md". */
  name: Accessor<string>;
  /** The file as its record reads it: its text, and the hash a save over it names. */
  read: Accessor<Disk>;
  /** Saves `text` over the version `hash` names: the hash of the version it wrote. */
  send: (text: string, hash: string) => Promise<{ hash: string }>;
}): Edited {
  const tracked = trackDisk(of.read);
  const disk = tracked.disk;
  const text = unsavedText(of.key, () => disk().text, { exact: of.exact });
  const changed = () => {
    const typed = text.entry();
    return typed !== undefined && text.dirty() && typed.base !== disk().text;
  };
  // `over`: the human chose to save over the file as it is now, after it changed.
  let over = false;
  const saves = saving(text, async (value) => {
    const from = untracked(disk);
    if (!over && untracked(changed)) {
      throw new Error(`${of.name()} changed on disk: see what changed, then take a version.`);
    }
    over = false;
    const answer = await of.send(value, from.hash);
    tracked.saved(from.hash, { hash: answer.hash, text: value });
  });
  return {
    changed,
    disk,
    save: saves.save,
    saveOver: () => {
      over = true;
      return saves.save();
    },
    saves,
    takeFile: text.discard,
    text,
  };
}
