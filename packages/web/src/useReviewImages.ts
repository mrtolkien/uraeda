import { useAnnounce } from "@astryxdesign/core/hooks";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useImageText } from "./attach/useImageText.ts";
import type { useFile } from "./data.ts";
import type { Refusals } from "./ReviewVerdict.tsx";
import type { useCommentDraft } from "./useCommentDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;

/** The refusal of a verdict while the comment being written holds images. */
const UNSENT_IMAGES = "Add or cancel your comment first: its images are not in the review yet.";

/** The refusal of a verdict while the image of a comment cancelled is still being added. */
const STILL_ADDING = "An image is still being added: wait for it, then try again.";

/** Whether a page message is a verdict's refusal for images, which goes once they are dealt with. */
const forImages = (message?: { text: string }) =>
  message?.text === UNSENT_IMAGES || message?.text === STILL_ADDING;

/**
 * The images of a review's comments: they go into the comment being written, or a new general
 * comment when none is, and hold the verdict while a comment not added yet links them, since a
 * commit deletes the images no file links (R64, R70, R71).
 */
export function useReviewImages(
  file: File,
  { draft, setText, start, text }: Draft,
  { setMessage }: Refusals,
  wide: boolean,
) {
  // Whether the comment being written holds images: they are in no file until it is added.
  const [linked, setLinked] = useState(false);
  // A verdict's refusal for images, which the form says on the phone.
  const [notice, setNotice] = useState<string>();
  // The comment being written, read by the upload's callbacks.
  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  // Which comment the text is: a new one with each cancel, add, or edit. The images of a run go
  // into the comment it started for, never into the next one (R71).
  const writing = useRef(0);
  const runFor = useRef(0);
  const announce = useAnnounce();
  const images = useImageText({
    label: "the comment",
    onStart: useCallback(async () => {
      if (!draftRef.current) {
        start({ kind: "general" });
      }
      runFor.current = writing.current;
      setMessage((shown) => (shown?.text === STILL_ADDING ? undefined : shown));
      setNotice((shown) => (shown === STILL_ADDING ? undefined : shown));
      return true;
    }, [setMessage, start]),
    // A comment cancelled, or replaced by another, during the upload keeps its text: the images
    // are in no file, and the next commit deletes them.
    onText: useCallback(
      (value: string, added: boolean) => {
        if (draftRef.current && runFor.current === writing.current) {
          setText(value);
          setLinked((was) => was || added);
          return true;
        }
        return false;
      },
      [setText],
    ),
    path: file.path,
    priority: 1,
    text,
  });

  /** A new comment is written: after a cancel, an add, or as an edit starts. */
  const next = () => {
    writing.current += 1;
    setLinked(false);
  };

  return {
    /** Whether a page message stays: the refusal for an image still being added goes once it is in. */
    hides: (message: { text: string }) => message.text === STILL_ADDING && !images.busy,
    /**
     * Refuses a verdict while a comment not added yet links images, or an image is still being
     * added, and says why; resolves with whether it refused. A refusal leaves the page's other
     * errors, like a hook's, as they are (R70).
     */
    hold: () => {
      const refused =
        draft && (linked || (images.busy && runFor.current === writing.current))
          ? UNSENT_IMAGES
          : images.busy
            ? STILL_ADDING
            : undefined;
      if (!refused) {
        setNotice(undefined);
        return false;
      }
      announce(refused, "assertive");
      // On the phone, the comment's sheet lies over the page's end: the form says it, if open.
      if (wide || !draft) {
        setMessage({ ok: false, text: refused });
      } else {
        setMessage((shown) => (forImages(shown) ? undefined : shown));
        setNotice(refused);
      }
      return true;
    },
    images,
    /** The comment closed: its images' refusals go with it. */
    notice: notice === STILL_ADDING && !images.busy ? undefined : notice,
    onClose: () => {
      next();
      setNotice(undefined);
      setMessage((shown) => (forImages(shown) ? undefined : shown));
    },
    onEdit: next,
  };
}
