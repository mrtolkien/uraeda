// A file opened as a buffer: its whole text, frontmatter included, as its field holds it, keyed
// `<path>#buffer` in the unsaved store, and its saves over the version read, as the proposal editor
// saves (`pane/useProposalEditor.ts`): written on the file's branch, never committed, a conflict
// kept for the banner that offers the text to copy or the new version to load.
import { useMemo, useState } from "react";
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { Buffer } from "uraeda-server/fate";
import { rereadChanges, useRefreshOnShow } from "../data.ts";
import { refusal } from "../errors.ts";
import { useTextField } from "../fields/useTextField.ts";
import { withFreshBase } from "../freshBase.ts";
import { useSave } from "../useSave.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A file opened as a buffer: its whole text, its hash, and the branch it is written on. */
const BufferView = view<Buffer>()({ branch: true, hash: true, id: true, path: true, text: true });

/** The request of a buffer's page, by the file's path from the top level. */
const bufferRequest = (path: string) => ({ buffer: { id: path, view: BufferView } });

/** A buffer as the server has it now, read outside a component: before a save, or to reload. */
async function readBuffer(fate: Fate, path: string) {
  const { buffer } = await fate.request(bufferRequest(path), { mode: "network-only" });
  if (!buffer) {
    return undefined;
  }
  // fate does not infer the view's type through `readView`: these are its fields.
  const fresh = (await fate.readView(BufferView, buffer)) as unknown as {
    data: { hash: string; text: string };
  };
  return fresh.data;
}

/**
 * The buffer of the file at `path`: `file`, undefined when it is no Markdown file of `specs/`; its
 * `field`; `saveText`, from `:w` or Ctrl+Enter, nothing when unchanged; `flush`, which resolves once
 * the saves sent are done; `conflict`, a save refused over a changed file, while its text is unsaved, and `reload`, which
 * shows the new version; and `refused`, any other refusal, like an agent's work on the feature.
 */
export function useBuffer(path: string) {
  const fate = useFateClient();
  const request = useMemo(() => bufferRequest(path), [path]);
  const { buffer } = useRequest(request);
  useRefreshOnShow(request);
  const file = useLiveView(BufferView, buffer) ?? undefined;
  const text = file?.text ?? "";
  // A raw file: a final line break or a first line's indent alone is an edit to save.
  const field = useTextField(`${path}#buffer`, text, { exact: true });
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
          : await readBuffer(fate, path).catch(() => undefined),
      (base) =>
        fate.mutations.buffer.save({
          input: { hash: base?.hash ?? previous, path, text: value },
          view: BufferView,
        }),
      (fresh) => fresh?.text === over,
    );
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { message: failed.message, ok: false };
    }
    field.saved(value);
    // The Git page, and the sidebar's count, list the file the save changed.
    rereadChanges(fate);
    return { ok: true, saved: result.result?.hash ?? previous };
  }, file?.hash ?? "");

  /** Reads the file again, and shows its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const fresh = await readBuffer(fate, path);
    if (fresh) {
      field.discard();
      save.settle(fresh.hash, true);
    }
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
    file,
    flush: save.flush,
    refused: state.kind === "error" && !conflict ? state.message : undefined,
    reload,
    saveText,
  };
}
