// A draft's or a proposal's text as its editor holds it, shared by the editor page and an entry's
// pane: its field, keyed `<path>#editor` in the unsaved store so both show the same unsaved text,
// its saves over the version read, its images, and its Commit and Start.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { asTyped, readDraft, useEditorImages, useMovedText } from "../attach/useEditorImages.ts";
import type { useDraft } from "../data.ts";
import { refusal } from "../errors.ts";
import { useTextField } from "../fields/useTextField.ts";
import { useEditorActions } from "../useEditorActions.ts";
import { type SaveState, useSave } from "../useSave.ts";
import { DraftView } from "../views.ts";

type Draft = ReturnType<typeof useDraft>;

/**
 * The editor of the draft at `path`, read as `draft`, its slug typed in `slug`. `drawn` says
 * whether its text shows drawn: on the editor page, a written proposal opens drawn, unless it holds
 * unsaved text; with `isDrawnFirst` false, as in a pane, it opens as text. Its `state` is the
 * save's, a conflict's own message aside, as the conflict says why already.
 */
export function useDraftEditor({
  draft,
  isDrawnFirst,
  path,
  slug,
}: {
  draft: Draft;
  isDrawnFirst: boolean;
  path: string;
  slug: ReturnType<typeof useTextField>;
}) {
  const fate = useFateClient();
  const moved = useMovedText(path);
  const field = useTextField(`${path}#editor`, asTyped(draft?.text ?? ""));
  const [drawn, setDrawn] = useState(
    () => isDrawnFirst && !moved && !field.entry && (draft?.written ?? false),
  );
  const [conflict, setConflict] = useState<string>();
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.text.save({
      input: { hash: previous, path, text: value },
      view: DraftView,
    });
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        setConflict(failed.message);
      }
      return { message: failed.message, ok: false };
    }
    field.saved(value);
    return { ok: true, saved: result.result?.hash ?? previous };
  }, draft?.hash ?? "");
  const images = useEditorImages({ draft, field, moved, path, save, setDrawn });
  const actions = useEditorActions({ draft, field, path, save, setConflict, slug });

  /** Reads the file again, and shows its text in place of the one that was not saved. */
  const reload = async () => {
    setConflict(undefined);
    const fresh = await readDraft(fate, path);
    if (fresh) {
      field.discard();
      save.settle(fresh.hash, true);
    }
  };
  /** Saves the text typed, from Save or Ctrl+Enter: nothing when it did not change. */
  const saveText = () => {
    if (field.dirty) {
      void save.save(field.text);
    }
  };
  const state: SaveState = images.busy
    ? { kind: "saving" }
    : conflict && save.state.kind === "error"
      ? { kind: "idle" }
      : save.state;
  return { actions, conflict, drawn, field, images, reload, saveText, setDrawn, state };
}

/** A draft's editor, as `useDraftEditor` gives it. */
export type DraftEditorState = ReturnType<typeof useDraftEditor>;
