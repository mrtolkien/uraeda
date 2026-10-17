// A draft's or a proposal's text as its editor holds it, shared by the editor page and an entry's
// pane: its field, keyed `<path>#editor` in the unsaved store so both show the same unsaved text,
// its saves over the version read, its images, and its Commit and Start. The field holds the text
// after the frontmatter, which the controls above it set, and each save joins it back.
import { useLayoutEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { readDraft, useEditorImages, useMovedText } from "../attach/useEditorImages.ts";
import type { useDraft } from "../data.ts";
import { refusal } from "../errors.ts";
import { readUnsaved, unsavedKey, writeUnsaved } from "../fields/unsaved.ts";
import { useTextField } from "../fields/useTextField.ts";
import { useRepositoryPath } from "../routes.tsx";
import { useEditorActions } from "../useEditorActions.ts";
import { type SaveState, useSave } from "../useSave.ts";
import { DraftView } from "../views.ts";
import { splitDraft, storedBody } from "./draftText.ts";

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
  const { body, head } = splitDraft(draft);
  const frontmatter = useFrontmatter(path, head);
  const field = useTextField(`${path}#editor`, body);
  const [drawn, setDrawn] = useState(
    () => isDrawnFirst && !moved && !field.entry && (draft?.written ?? false),
  );
  const [conflict, setConflict] = useState<string>();
  const save = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.text.save({
      input: { hash: previous, path, text: `${frontmatter.head()}${value}` },
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
  const actions = useEditorActions({
    draft,
    field,
    path,
    save,
    setConflict,
    slug,
    written: frontmatter.take,
  });

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

/**
 * The frontmatter a save of the field at `path` joins back before its text: `head`, the file's as
 * read, or the one the discovery control wrote, as a save queued after it runs before the page
 * draws it. An unsaved text the field kept before it hid the frontmatter loses it as it shows.
 */
function useFrontmatter(path: string, head: string) {
  const frontmatter = useRef(head);
  const key = unsavedKey(useRepositoryPath(), `${path}#editor`);
  useLayoutEffect(() => {
    frontmatter.current = head;
    const stored = readUnsaved(key);
    if (!head || !stored) {
      return;
    }
    // Before, the field held the whole file: both the text and the one it was typed over.
    const text = storedBody(stored.text);
    const base = storedBody(stored.base);
    if (text !== undefined && base !== undefined) {
      writeUnsaved(key, { ...stored, base, text });
    }
  }, [head, key]);
  return {
    head: () => frontmatter.current,
    take: (fresh: Parameters<typeof splitDraft>[0]) => {
      frontmatter.current = splitDraft(fresh).head;
    },
  };
}

/** A draft's editor, as `useDraftEditor` gives it. */
export type DraftEditorState = ReturnType<typeof useDraftEditor>;
