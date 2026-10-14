import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { useDraft } from "../data.ts";
import { redirect, repoPath, useRepository } from "../routes.tsx";
import type { useSave } from "../useSave.ts";
import { DraftView } from "../views.ts";
import type { AttachStatus } from "./useAttach.ts";
import { type Linked, useImageText } from "./useImageText.ts";

type Fate = ReturnType<typeof useFateClient>;
type Draft = ReturnType<typeof useDraft>;

/**
 * The text of a draft that became a folder as an image was added, with the image's link, for its
 * editor at the new path, and the last upload's status: what was typed there is saved at the new
 * path.
 */
const movedTexts = new Map<string, Linked & { status?: AttachStatus }>();

/**
 * A file's text as its field holds it: a text field's value has LF line breaks, whatever the file
 * has, and the cursor's positions count them so (R50).
 */
export const asTyped = (text: string) => text.replaceAll(/\r\n?/g, "\n");

/** Reads a draft's text and hash from the server, past what the page holds. */
export async function readDraft(fate: Fate, path: string) {
  const { draft: ref } = await fate.request(
    { draft: { id: path, view: DraftView } },
    { mode: "network-only" },
  );
  if (!ref) {
    return undefined;
  }
  // fate does not infer the view's type through `readView`: these are its fields.
  const fresh = (await fate.readView(DraftView, ref)) as unknown as {
    data: { hash: string; text: string };
  };
  return fresh.data;
}

/**
 * The text, with an image's link, that a draft that just became a folder brings to its editor at
 * the new path, once.
 */
export function useMovedText(path: string) {
  const [moved] = useState(() => movedTexts.get(path));
  return moved;
}

/**
 * Where a run of uploads that moved the draft ends: on its new page, or, once the human left, its
 * text with the links saved at the new path, over its version now.
 */
function useOnMoved(release: () => void) {
  const fate = useFateClient();
  const repo = useRepository();
  // An upload that ends after the human left saves its text, and leaves them where they went.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(
    (next: string, linked: Linked, status?: AttachStatus) => {
      release();
      if (mounted.current) {
        movedTexts.set(next, { ...linked, status });
        redirect(repoPath(repo, `/edit/${next}`));
        return;
      }
      void (async () => {
        const moved = await readDraft(fate, next);
        if (moved) {
          await fate.mutations.text.save({
            input: { hash: moved.hash, path: next, text: linked.text },
            view: DraftView,
          });
        }
      })();
    },
    [fate, release, repo],
  );
}

/**
 * The images of the editor's text: while they upload, the text is held, not saved, as a draft may
 * move into a folder meanwhile; once they are in, it is saved with their links. A text changed
 * elsewhere replaces the one shown when nothing of it waits to be saved, nor is held. Typing during
 * an upload is saved once it ends, and leaving before then asks first.
 */
export function useEditorImages({
  draft,
  moved,
  path,
  save,
  setDrawn,
  setText,
  text,
}: {
  draft: Draft;
  moved: ReturnType<typeof useMovedText>;
  path: string;
  save: ReturnType<typeof useSave<string>>;
  setDrawn: (drawn: boolean) => void;
  setText: (text: string) => void;
  text: string;
}) {
  const { flush, idle, schedule, settle } = save;
  const holding = useRef(false);
  // The text shown, and the draft read, for the callbacks to read.
  const shown = useRef(text);
  const latestDraft = useRef(draft);
  useLayoutEffect(() => {
    shown.current = text;
    latestDraft.current = draft;
  });
  // The text saved as the upload started: a refused image leaves nothing new to save but typing.
  const started = useRef(text);
  useEffect(() => {
    if (moved) {
      movedTexts.delete(path);
      schedule(moved.text, true);
    }
  }, [moved, path, schedule]);
  /**
   * Takes the draft's text in place of the one shown when nothing of it waits to be saved, and its
   * hash as the version the next save is made over. Not while an upload holds the text: the save
   * after it is made over the version the upload started from, and refused as a conflict if the
   * file changed meanwhile.
   */
  const adopt = useCallback(() => {
    const current = latestDraft.current;
    if (!current || holding.current) {
      return;
    }
    if (idle() && asTyped(current.text) !== shown.current) {
      setText(asTyped(current.text));
    }
    settle(current.hash);
  }, [idle, setText, settle]);
  const images = useImageText({
    initialSelection: moved?.selection,
    initialStatus: moved?.status,
    label: path.split("/").at(-1) ?? path,
    onLinks: setText,
    onMoved: useOnMoved(
      useCallback(() => {
        holding.current = false;
      }, []),
    ),
    onStart: useCallback(async () => {
      holding.current = true;
      started.current = shown.current;
      setDrawn(false);
      if (await flush()) {
        return true;
      }
      holding.current = false;
      return false;
    }, [flush, setDrawn]),
    onText: useCallback(
      (value: string, added: boolean) => {
        holding.current = false;
        setText(value);
        // What was typed during the upload is saved too; with nothing to save, the draft read
        // meanwhile is taken.
        if (added || value !== started.current) {
          schedule(value, added);
        } else {
          adopt();
        }
      },
      [adopt, schedule, setText],
    ),
    path,
    priority: 1,
    text,
  });
  useEffect(adopt, [draft, adopt]);
  useEffect(() => {
    if (!images.busy) {
      return;
    }
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [images.busy]);
  return { holding, images };
}
