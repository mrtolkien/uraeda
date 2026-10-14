import { useState } from "react";
import { useFateClient } from "react-fate";
import type { useDraft } from "./data.ts";
import { refusal } from "./errors.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import type { useSave } from "./useSave.ts";
import { DraftView, FeatureView } from "./views.ts";

type Draft = NonNullable<ReturnType<typeof useDraft>>;

/**
 * The editor's actions on its draft or proposal, each after the text shown is saved: commit it,
 * start it as a feature under `slug`, and set its discovery effort, in the save queue. `message`
 * says what the last one did, or why it did not.
 */
export function useEditorActions({
  draft,
  path,
  save,
  setConflict,
  setText,
  slug,
}: {
  draft: Draft | undefined;
  path: string;
  save: ReturnType<typeof useSave<string>>;
  setConflict: (conflict: string) => void;
  setText: (text: string) => void;
  slug: string;
}) {
  const fate = useFateClient();
  const here = useRepoPath();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();

  const commit = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ ok: false, text: "Your text is not saved: nothing was committed." });
      return;
    }
    const result = await fate.mutations.text.commit({ input: { path }, view: DraftView });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
      return;
    }
    const folder = draft?.folder;
    if (continues && folder) {
      handOver(folder, "proposal", path.split("/").at(-1));
    } else {
      setMessage({ ok: true, text: "Committed." });
    }
  };
  const start = async (continues: boolean) => {
    setMessage(undefined);
    if (!(await save.flush())) {
      setMessage({ ok: false, text: "Your text is not saved: the feature was not started." });
      return;
    }
    const result = await fate.mutations.feature.start({
      input: { draft: path, slug },
      view: FeatureView,
    });
    if (result.error) {
      setMessage({ ok: false, text: refusal(result.error).message });
    } else if (typeof result.result?.folder === "string") {
      const folder = result.result.folder;
      if (continues) {
        handOver(folder, "start");
      } else {
        navigate(here(`/f/${folder}`));
      }
    }
  };
  /**
   * Sets the discovery effort in the frontmatter, in the save queue: after the text shown is saved,
   * and before a later save, commit, or start.
   */
  const setDiscovery = async (level: string) => {
    setMessage(undefined);
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
      if (result.result) {
        setText(result.result.text);
        return { ok: true, saved: result.result.hash };
      }
      return { ok: true, saved: previous };
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
