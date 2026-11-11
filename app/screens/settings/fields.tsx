// What the categories of the settings file share: a text a setting saves, kept on the device while
// it is typed and not saved, and the file's problem, which takes the place of its controls.
import { signal, untracked } from "nsh";
import { record } from "../../store";
import { Banner, refusalOf } from "../../ui/controls";
import { unsavedText } from "../../ui/text";

/** The settings as the server applies them, and the file they are kept in. */
export const settingsRecord = () => record("Settings", null);

/**
 * A setting typed in a field: its text, kept on the device until saved; `submit` sends it, then
 * the field shows what the server keeps, or why it refused, under it. `clear` empties the field
 * once saved, as the field that adds a host name does.
 */
export function savedField(
  key: string,
  saved: () => string,
  save: (text: string) => Promise<unknown>,
  clear = false,
) {
  const field = unsavedText(`settings:${key}`, saved);
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const submit = async () => {
    const text = untracked(field.text);
    if (untracked(pending)) return;
    pending.set(true);
    refusal.set(null);
    try {
      await save(text);
      if (clear) field.discard();
      else field.saved(text);
    } catch (error) {
      refusal.set(refusalOf(error));
    }
    pending.set(false);
  };
  return { field, pending, refusal, submit };
}

/** The file that cannot be read: why, and that its defaults apply until it is fixed. */
export function FileProblem(props: { file: string; problem: string }) {
  return (
    <Banner title={`${props.file} cannot be read`} tone="danger">
      {`${props.problem} Until it is fixed, the server runs on its defaults, and nothing here writes the file: fix it by hand, and this page follows.`}
    </Banner>
  );
}
