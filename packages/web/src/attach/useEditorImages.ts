import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { useDraft } from "../data.ts";
import { unsavedKey, writeUnsaved } from "../fields/unsaved.ts";
import { splitDraft } from "../pane/draftText.ts";
import { redirect, repoPath, useRepository, useRepositoryPath } from "../routes.tsx";
import type { useTextField } from "../fields/useTextField.ts";
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
    data: { document: { frontmatterLines?: { end: number } }; hash: string; text: string };
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
 * Where a run of uploads that moved the draft ends: on its new page, its text with the links kept
 * there as the editor's unsaved text over `base`, the draft's text before after its frontmatter,
 * which that page saves at once; or, once the human left, its text saved at the new path, over its
 * version now.
 */
function useOnMoved(release: () => void, base: string) {
  const fate = useFateClient();
  const repo = useRepository();
  const repoFolder = useRepositoryPath();
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
        writeUnsaved(unsavedKey(repoFolder, `${next}#editor`), {
          at: new Date().toISOString(),
          base,
          text: linked.text,
        });
        redirect(repoPath(repo, `/edit/${next}`));
        return;
      }
      void (async () => {
        const moved = await readDraft(fate, next);
        if (moved) {
          await fate.mutations.text.save({
            // The field's text is the one after the frontmatter, which stays the file's.
            input: {
              hash: moved.hash,
              path: next,
              text: `${splitDraft(moved).head}${linked.text}`,
            },
            view: DraftView,
          });
        }
      })();
    },
    [base, fate, release, repo, repoFolder],
  );
}

/**
 * The images of the editor's text, its field `field`: a run of uploads saves the text typed first,
 * and holds the version the next save is made over, as a draft may move into a folder meanwhile;
 * once the images are in, the text is saved at once with their links, and what was typed during
 * the run with it. A draft read takes its version as the one the next save is made over when the
 * field holds no unsaved text, nor a run holds it. Leaving during an upload asks first.
 */
export function useEditorImages({
  draft,
  field,
  moved,
  path,
  save,
  setDrawn,
}: {
  draft: Draft;
  field: ReturnType<typeof useTextField>;
  moved: ReturnType<typeof useMovedText>;
  path: string;
  save: ReturnType<typeof useSave<string>>;
  setDrawn: (drawn: boolean) => void;
}) {
  const { idle, settle } = save;
  const holding = useRef(false);
  // The draft read, for the callbacks to read.
  const latestDraft = useRef(draft);
  useLayoutEffect(() => {
    latestDraft.current = draft;
  });
  // The text a draft that moved into a folder brought, with its images' links, kept as this
  // field's unsaved text: saved here at once, as the page opens.
  const saveMoved = useEffectEvent((text: string) => void save.save(text));
  useEffect(() => {
    if (moved) {
      movedTexts.delete(path);
      saveMoved(moved.text);
    }
  }, [moved, path]);
  /**
   * Takes the draft's version as the one the next save is made over, when nothing is unsaved or
   * being saved. Not while an upload holds it: the save after it is made over the version the
   * upload started from, and refused as a conflict if the file changed meanwhile. Nor while the
   * field holds unsaved text, which a save over a file changed since would replace unseen.
   */
  const adopt = () => {
    const current = latestDraft.current;
    if (current && !holding.current && idle() && !field.unsavedNow()) {
      settle(current.hash);
    }
  };
  const images = useImageText({
    initialSelection: moved?.selection,
    initialStatus: moved?.status,
    label: path.split("/").at(-1) ?? path,
    onLinks: field.change,
    onMoved: useOnMoved(() => {
      holding.current = false;
      // The text, typed during the run included, goes to the new path.
      field.discard();
    }, splitDraft(draft).body),
    onStart: async () => {
      holding.current = true;
      setDrawn(false);
      const unsaved = field.unsavedNow();
      if (await (unsaved ? save.save(unsaved.text) : save.flush())) {
        return true;
      }
      holding.current = false;
      return false;
    },
    onText: (value: string, added: boolean) => {
      holding.current = false;
      if (value !== field.text) {
        field.change(value);
      }
      if (added) {
        void save.save(value);
      } else {
        adopt();
      }
    },
    path,
    priority: 1,
    text: field.text,
  });
  const adoptRead = useEffectEvent(adopt);
  // A draft read, or the field's unsaved text gone, as discarded.
  useEffect(() => adoptRead(), [draft, field.dirty]);
  useEffect(() => {
    if (!images.busy) {
      return;
    }
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [images.busy]);
  return images;
}
