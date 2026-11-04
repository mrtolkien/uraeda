// A whole file in the editor, saved over the version read, as a buffer's (`buffer/useBuffer.ts`)
// and a conflicted file's (`git/ConflictEditor.tsx`) are: its field keyed in the unsaved store, a
// stale hash read again and written over once, a conflict with another writer kept for the banner
// that offers the text to copy or the new version to load.
import { useState } from "react";
import type { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { withFreshBase } from "../freshBase.ts";
import { useSave } from "../useSave.ts";
import { useTextField } from "./useTextField.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A version of a file: its text, and the hash a save is written over. */
export type FileVersion = { hash: string; text: string };

/** A save's answer: the refusal, or the file as written. */
type Written = { error?: unknown; result?: { hash: string } | null };

/**
 * The version of a file as the server has it now, read outside a component, by `request`, whose
 * single root is the file, read through `view`: undefined when there is none.
 */
export async function readVersion(
  fate: Fate,
  request: Parameters<Fate["request"]>[0],
  view: Parameters<Fate["readView"]>[0],
): Promise<FileVersion | undefined> {
  const answer: Record<string, unknown> = await fate.request(request, { mode: "network-only" });
  const [ref] = Object.values(answer);
  if (!ref) {
    return undefined;
  }
  // fate types the request's root as any entity: the view gives the file's fields.
  const { data } = await fate.readView(view, ref as Parameters<Fate["readView"]>[1]);
  return data as unknown as FileVersion;
}

/**
 * The file `file`, its text in the field keyed `key`: `saveText`, nothing when unchanged; `flush`,
 * which resolves once the saves sent are done; `conflict`, a save refused over a changed file,
 * while its text is unsaved, and `reload`, which shows the new version, or drops the text when the
 * file is gone; and `refused`, any other refusal, like an agent's work. `read` reads the file from
 * the server, `write` saves a text over a hash, and `onSaved` follows each save that wrote.
 */
export function useFileEditor({
  file,
  key,
  onSaved,
  read,
  write,
}: {
  file: FileVersion | undefined;
  key: string;
  onSaved?: () => void;
  read: () => Promise<FileVersion | undefined>;
  write: (hash: string, text: string) => Promise<Written>;
}) {
  const text = file?.text ?? "";
  // A raw file: a final line break or a first line's indent alone is an edit to save.
  const field = useTextField(key, text, { exact: true });
  const [conflict, setConflict] = useState<string>();
  // The conflict goes with the text it kept: undone back to the file's, there is nothing to copy.
  if (conflict !== undefined && !field.dirty) {
    setConflict(undefined);
  }
  const save = useSave<string>(async (value, previous) => {
    // The file as the page shows it, the text typed over: a conflict over it is a stale hash, read
    // again and written over once. A text another writer changed keeps the conflict.
    const over = field.unsavedNow()?.base ?? text;
    const result = await withFreshBase(
      async (mode) =>
        mode === "cache-first"
          ? { hash: previous, text: over }
          : await read().catch(() => undefined),
      (base) => write(base?.hash ?? previous, value),
      (fresh) => fresh?.text === over,
    ).catch((error: unknown): Written => ({ error }));
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { message: failed.message, ok: false };
    }
    field.saved(value);
    onSaved?.();
    return { ok: true, saved: result.result?.hash ?? previous };
  }, file?.hash ?? "");

  /** Reads the file again, and shows its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const fresh = await read();
    field.discard();
    save.settle(fresh?.hash ?? "", true);
  };
  const saveText = () => {
    if (field.dirty) {
      void save.save(field.text);
    }
  };
  const { state } = save;
  return {
    conflict,
    field,
    flush: save.flush,
    refused: state.kind === "error" && !conflict ? state.message : undefined,
    reload,
    saveText,
  };
}
