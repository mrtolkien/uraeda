// A conflicted file in the shared editor, at `/git?conflict=<path>`: the Git page's detail on wide
// screens, a page of its own on the phone. A bar over each conflict takes a side, by branch, or
// both; the text stays editable, unsaved and marked so until the human saves it, with Save or
// Ctrl+Enter, over the version read: a file changed since is refused, its text kept to copy, or the
// new version loaded, as a buffer's (`fields/useFileEditor.ts`). Saved without markers, the file
// reads resolved, and Continue goes on. It is drawn only while the page lists the file, as its
// record is not sent live: read afresh each time it opens.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMemo } from "react";
import { useFateClient, useLiveView, useRequest, view } from "react-fate";
import type { ConflictFile } from "uraeda-server/fate";
import { useRefreshOnShow } from "../data.ts";
import { conflictBar } from "../fields/editor/conflictBar.ts";
import { conflictsIn } from "../fields/editor/conflicts.ts";
import { Editor } from "../fields/editor/Editor.tsx";
import { RestoreNotice } from "../fields/RestoreNotice.tsx";
import { readVersion, useFileEditor } from "../fields/useFileEditor.ts";
import { useKeys } from "../keys/registry.tsx";
import { plural } from "../labels.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Pane } from "../layout/Pane.tsx";
import { ConflictBanner } from "../pane/ProposalEditor.tsx";
import { Back } from "./Back.tsx";
import { gitAddress } from "./address.ts";
import type { Stopped } from "./useConflictWrites.ts";

const ConflictFileView = view<ConflictFile>()({ hash: true, id: true, path: true, text: true });

/** The request of a conflicted file, by its path. */
const fileRequest = (path: string) => ({ conflictFile: { id: path, view: ConflictFileView } });

/** The sentence of the restore notice when the file changed since the text was typed. */
const FILE_CHANGED = "The file changed since: saving replaces it.";

/** The conflicted file at `path`, read afresh as it opens, its field, its saves, and a refusal. */
function useConflictFile(path: string) {
  const fate = useFateClient();
  const request = useMemo(() => fileRequest(path), [path]);
  const { conflictFile } = useRequest(request, { mode: "network-only" });
  useRefreshOnShow(request);
  const file = useLiveView(ConflictFileView, conflictFile) ?? undefined;
  const editor = useFileEditor({
    file,
    key: `${path}#conflict`,
    read: () => readVersion(fate, request, ConflictFileView),
    write: (hash, text) => {
      const write = { href: gitAddress({ kind: "conflict", path }), label: `Saving ${path}` };
      return fate.mutations.git.saveConflict({
        input: { hash, path, text, write },
        view: ConflictFileView,
      });
    },
  });
  return { ...editor, file };
}

/** The pane of a file that no longer conflicts, or never did. */
export function NoConflict({ isNarrow, path }: { isNarrow: boolean; path: string }) {
  return (
    <Pane actions={<Back isNarrow={isNarrow} />} title={path}>
      <Text color="secondary">{path} no longer conflicts.</Text>
    </Pane>
  );
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
    return <NoConflict isNarrow={isNarrow} path={path} />;
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
