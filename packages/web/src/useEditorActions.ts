import { useState } from "react";
import { useFateClient } from "react-fate";
import type { useProposalFile } from "./data.ts";
import type { useTextField } from "./fields/useTextField.ts";
import { refusal } from "./errors.ts";
import type { splitProposal } from "./pane/proposalText.ts";
import { handOver } from "./sessions.ts";
import type { useSave } from "./useSave.ts";
import type { StartKind } from "./ProposalStart.tsx";
import { useStart } from "./useStart.ts";
import { ProposalFileView } from "./views.ts";
import { useClearRefusal, writeHere } from "./writes/useWriteQueue.ts";

type File = NonNullable<ReturnType<typeof useProposalFile>>;

/** What the editor's actions act on, and what they tell it. */
type Editor = {
  field: ReturnType<typeof useTextField>;
  file: File | undefined;
  path: string;
  save: ReturnType<typeof useSave<string>>;
  setConflict: (conflict: string) => void;
  slug: ReturnType<typeof useTextField>;
  written: (fresh: Parameters<typeof splitProposal>[0]) => void;
};

/**
 * The editor's actions on its proposal file, or a started proposal, each after the text typed in
 * `field` is saved: commit it, start it as a feature or a change under the slug typed in `slug`,
 * and set its discovery effort, in the save queue. `written` takes the file the discovery effort was
 * written into. `message` says what the last one did, or why it did not; `slugError`, why the slug
 * typed started nothing.
 */
export function useEditorActions({ field, file, path, save, setConflict, slug, written }: Editor) {
  const fate = useFateClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const clearRefusal = useClearRefusal({ file: path });
  /** Saves the text typed, after the saves before it; resolves with whether the text is saved. */
  const saveTyped = () => {
    const unsaved = field.unsavedNow();
    return unsaved ? save.save(unsaved.text) : save.flush();
  };

  const commit = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await saveTyped())) {
      setMessage({ ok: false, text: "Your text is not saved: nothing was committed." });
      return false;
    }
    clearRefusal();
    const result = await fate.mutations.text.commit({
      input: { path, write: writeHere(`Committing the proposal of ${file?.title ?? path}`) },
      view: ProposalFileView,
    });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return false;
    }
    if (continues && file?.folder) {
      handOver(file.folder, "proposal", path.split("/").at(-1));
    } else {
      setMessage({ ok: true, text: "Committed." });
    }
    return true;
  };
  const starting = useStart({ path, saveTyped, slug, title: file?.title ?? path });
  /** Starts it as `kind`: its session opens at once, or the editor says why not. */
  const start = async (kind: StartKind) => {
    setMessage(undefined);
    const started = await starting.start(kind);
    if (typeof started === "object") {
      setMessage({ ok: false, text: started.notSaved });
      return false;
    }
    return started;
  };
  /**
   * Sets the discovery effort in the frontmatter, in the save queue: after the text typed is saved,
   * as the effort is written into it, and before a later save, commit, or start (R21).
   */
  const setDiscovery = async (level: string) => {
    setMessage(undefined);
    void saveTyped();
    let refused: string | undefined;
    const wrote = await save.write(async (previous) => {
      const result = await fate.mutations.text.discovery({
        input: { hash: previous, level, path },
        optimistic: { discovery: level, id: path },
        view: ProposalFileView,
      });
      if (result.error) {
        const failed = refusal(result.error);
        if (failed.kind === "conflict") {
          setConflict(failed.message);
        } else {
          refused = failed.message;
        }
        return { message: failed.message, ok: false };
      }
      written(result.result ?? null);
      return { ok: true, saved: result.result?.hash ?? previous };
    });
    if (!wrote) {
      setMessage({
        ok: false,
        text: refused ?? "Your text is not saved: the discovery effort was not set.",
      });
    }
  };
  return { commit, message, setDiscovery, slugError: starting.slugError, start };
}
