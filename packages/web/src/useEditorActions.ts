import { useState } from "react";
import { useFateClient } from "react-fate";
import type { useDraft } from "./data.ts";
import type { useTextField } from "./fields/useTextField.ts";
import { refusal } from "./errors.ts";
import type { splitDraft } from "./pane/draftText.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import type { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";

type Draft = NonNullable<ReturnType<typeof useDraft>>;

/** What the editor's actions act on, and what they tell it. */
type Editor = {
  draft: Draft | undefined;
  field: ReturnType<typeof useTextField>;
  path: string;
  save: ReturnType<typeof useSave<string>>;
  setConflict: (conflict: string) => void;
  slug: ReturnType<typeof useTextField>;
  written: (fresh: Parameters<typeof splitDraft>[0]) => void;
};

/**
 * The editor's actions on its draft or proposal, each after the text typed in `field` is saved:
 * commit it, start it as a feature under the slug typed in `slug`, and set its discovery effort,
 * in the save queue. `written` takes the file the discovery effort was written into. `message`
 * says what the last one did, or why it did not.
 */
export function useEditorActions({ draft, field, path, save, setConflict, slug, written }: Editor) {
  const fate = useFateClient();
  const here = useRepoPath();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
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
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return false;
    }
    if (continues && draft?.folder) {
      handOver(draft.folder, "proposal", path.split("/").at(-1));
    } else {
      setMessage({ ok: true, text: "Committed." });
    }
    return true;
  };
  const start = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await saveTyped())) {
      setMessage({ ok: false, text: "Your text is not saved: the feature was not started." });
      return false;
    }
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug: slug.text },
      view: FeatureView,
    });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return false;
    }
    if (typeof result.result?.folder === "string") {
      const folder = result.result.folder;
      slug.discard();
      if (continues) {
        handOver(folder, "start");
      } else {
        navigate(here(`/f/${folder}`));
      }
    }
    return true;
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
        view: DraftView,
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
  return { commit, message, setDiscovery, start };
}
