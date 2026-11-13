// What the categories of the settings file share: a text a setting saves, kept on the device while
// it is typed and not saved, and the file's problem, which takes the place of its controls.
import { signal } from "nsh";
import { record } from "../../store";
import { Banner } from "../../ui/controls";
import { unsavedText } from "../../ui/text";

/** The settings as the server applies them, and the file they are kept in. */
export const settingsRecord = () => record("Settings", null);

/**
 * A setting typed in a field: its text, kept on the device until saved; `submit` sends it as it is
 * then, and the field shows what the server keeps, or why it refused, under it. What is typed
 * while it is sent stays in the field. `clear` is a field that adds, as a host name's: its text
 * leaves it as it is sent, and comes back if the server refuses.
 */
export function savedField(
  key: string,
  saved: () => string,
  save: (text: string) => Promise<unknown>,
  clear = false,
) {
  const field = unsavedText(`settings:${key}`, saved);
  const refusal = signal<string | null>(null);
  const submit = async () => {
    refusal.set(null);
    const done = await (clear ? field.send(save) : field.save(save));
    if (!done.ok && done.why !== null) refusal.set(done.why);
  };
  return { field, pending: field.pending, refusal, submit };
}

/** The file that cannot be read: why, and that its defaults apply until it is fixed. */
export function FileProblem(props: { file: string; problem: string }) {
  return (
    <Banner title={`${props.file} cannot be read`} tone="danger">
      {`${props.problem} Until it is fixed, the server runs on its defaults, and nothing here writes the file: fix it by hand, and this page follows.`}
    </Banner>
  );
}
