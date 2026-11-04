// A file opened as a buffer: its whole text, frontmatter included, as its field holds it, keyed
// `<path>#buffer` in the unsaved store, and its saves over the version read
// (`fields/useFileEditor.ts`), as the proposal editor saves (`pane/useProposalEditor.ts`): written
// on the file's branch, never committed.
import { useMemo } from "react";
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { Buffer } from "uraeda-server/fate";
import { rereadChanges, useRefreshOnShow } from "../data.ts";
import { readVersion, useFileEditor } from "../fields/useFileEditor.ts";

/** A file opened as a buffer: its whole text, its hash, and the branch it is written on. */
const BufferView = view<Buffer>()({ branch: true, hash: true, id: true, path: true, text: true });

/** The request of a buffer's page, by the file's path from the top level. */
const bufferRequest = (path: string) => ({ buffer: { id: path, view: BufferView } });

/**
 * The buffer of the file at `path`: `file`, undefined when it is no Markdown file of `specs/`, and
 * its editor's (see `useFileEditor`): `field`; `saveText`, from `:w` or Ctrl+Enter; `flush`;
 * `conflict` and `reload`; and `refused`, any other refusal, like an agent's work on the feature.
 */
export function useBuffer(path: string) {
  const fate = useFateClient();
  const request = useMemo(() => bufferRequest(path), [path]);
  const { buffer } = useRequest(request);
  useRefreshOnShow(request);
  const file = useLiveView(BufferView, buffer) ?? undefined;
  const editor = useFileEditor({
    file,
    key: `${path}#buffer`,
    // The Git page, and the sidebar's count, list the file the save changed.
    onSaved: () => rereadChanges(fate),
    read: () => readVersion(fate, request, BufferView),
    write: (hash, text) =>
      fate.mutations.buffer.save({ input: { hash, path, text }, view: BufferView }),
  });
  return { ...editor, file };
}
