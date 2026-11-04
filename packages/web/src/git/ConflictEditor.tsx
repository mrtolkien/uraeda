// A conflicted file in the shared editor, at `/git?conflict=<path>`: the Git page's detail on wide
// screens, a page of its own on the phone. A bar over each conflict takes a side, by branch, or
// both; the text stays editable, unsaved and marked so until the human saves it, with Save or
// Ctrl+Enter, over the version read: a file changed since is refused, its text kept to copy, or the
// new version loaded, as a buffer's (`buffer/useBuffer.ts`). Saved without markers, the file reads
// resolved, and Continue goes on.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMemo, useState } from "react";
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { ConflictFile } from "uraeda-server/fate";
import { refusal } from "../errors.ts";
import { conflictBar } from "../fields/editor/conflictBar.ts";
import { conflictsIn } from "../fields/editor/conflicts.ts";
import { Editor } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { useKeys } from "../keys/registry.tsx";
import { plural } from "../labels.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Pane } from "../layout/Pane.tsx";
import { ConflictBanner } from "../pane/ProposalEditor.tsx";
import { useSave } from "../useSave.ts";
import { Back } from "./Back.tsx";
import { gitAddress } from "./address.ts";
import type { Stopped } from "./useConflictWrites.ts";

const ConflictFileView = view<ConflictFile>()({ hash: true, id: true, path: true, text: true });

/** The request of a conflicted file, by its path. */
const fileRequest = (path: string) => ({ conflictFile: { id: path, view: ConflictFileView } });

/** The sentence of the restore notice when the file changed since the text was typed. */
const FILE_CHANGED = "The file changed since: saving replaces it.";

/** The conflicted file at `path`, its field, its saves, and a refused save. */
function useConflictFile(path: string) {
  const fate = useFateClient();
  const request = useMemo(() => fileRequest(path), [path]);
  const { conflictFile } = useRequest(request);
  const file = useLiveView(ConflictFileView, conflictFile) ?? undefined;
  const field = useTextField(`${path}#conflict`, file?.text ?? "", { exact: true });
  const [conflict, setConflict] = useState<string>();
  if (conflict !== undefined && !field.dirty) {
    setConflict(undefined);
  }
  const save = useSave<string>(async (text, hash) => {
    const write = { href: gitAddress({ kind: "conflict", path }), label: `Saving ${path}` };
    const result = await fate.mutations.git
      .saveConflict({ input: { hash, path, text, write }, view: ConflictFileView })
      .catch((error: unknown) => ({ error, result: undefined }));
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { message: failed.message, ok: false };
    }
    field.saved(text);
    return { ok: true, saved: result.result?.hash ?? hash };
  }, file?.hash ?? "");
  const reload = async () => {
    setConflict(undefined);
    const { conflictFile: fresh } = await fate.request(request, { mode: "network-only" });
    const read = fresh
      ? ((await fate.readView(ConflictFileView, fresh)) as unknown as { data: { hash: string } })
      : undefined;
    if (read) {
      field.discard();
      save.settle(read.data.hash, true);
    }
  };
  const { state } = save;
  return {
    conflict,
    field,
    file,
    refused: state.kind === "error" && !conflict ? state.message : undefined,
    reload,
    saveText: () => {
      if (field.dirty) {
        void save.save(field.text);
      }
    },
  };
}

/** The conflicted file at `path` in the editor, its bar naming the sides of `stopped`. */
export function ConflictEditor({
  isDisabled,
  isNarrow,
  path,
  stopped,
}: {
  isDisabled: boolean;
  isNarrow: boolean;
  path: string;
  stopped: Stopped;
}) {
  const editor = useConflictFile(path);
  const { field } = editor;
  const bar = useMemo(
    () => conflictBar({ ours: stopped.ours, theirs: stopped.theirs }),
    [stopped.ours, stopped.theirs],
  );
  useKeys(
    editor.file ? [{ hint: "⌃⏎", keys: "mod+Enter", label: "save", run: editor.saveText }] : [],
  );
  if (!editor.file) {
    return (
      <Pane actions={<Back isNarrow={isNarrow} />} title={path}>
        <Text color="secondary">{path} no longer conflicts.</Text>
      </Pane>
    );
  }
  const left = conflictsIn(field.text).length;
  return (
    <Pane
      actions={
        <HStack gap={1}>
          <Button
            isDisabled={isDisabled || !field.dirty}
            label="Save"
            onClick={editor.saveText}
            variant={field.dirty ? "primary" : "ghost"}
          />
          <Back isNarrow={isNarrow} />
        </HStack>
      }
      title={`${path} · ${left === 0 ? "no conflict left" : plural(left, "conflict")}`}
    >
      <VStack gap={2}>
        {field.restored && (
          <RestoreNotice
            changed={FILE_CHANGED}
            onDiscard={field.discard}
            restored={field.restored}
          />
        )}
        <ConflictBanner editor={editor} />
        {editor.refused !== undefined && (
          <AnnouncedBanner collapsible={false} status="error" title={editor.refused} />
        )}
        {/* Keyed by the sides' names, which the bar's extension, the editor's first, carries. */}
        <Editor
          extensions={[bar]}
          isDisabled={isDisabled}
          key={`${stopped.ours}\u0000${stopped.theirs}`}
          label={path}
          onChange={field.change}
          onSubmit={editor.saveText}
          rows={20}
          value={field.text}
          variant="lines"
        />
        {field.dirty && (
          <Text color="secondary" type="supporting">
            Unsaved: Save writes the file, which reads resolved once no conflict is left.
          </Text>
        )}
      </VStack>
    </Pane>
  );
}
