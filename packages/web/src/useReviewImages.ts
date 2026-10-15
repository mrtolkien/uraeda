import { useAnnounce } from "@astryxdesign/core/hooks";
import { createContext, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useImageText } from "./attach/useImageText.ts";
import type { useFile } from "./data.ts";
import type { useTextField } from "./fields/useTextField.ts";
import type { Refusals } from "./ReviewVerdict.tsx";
import type { useCommentDraft } from "./useCommentDraft.ts";

type File = NonNullable<ReturnType<typeof useFile>>;
type Draft = ReturnType<typeof useCommentDraft>;

/** The refusal of a verdict while the comment being written holds text not added, or images. */
const UNSENT = "Add or cancel your comment first.";

/**
 * The images of the comment being written, for what reads them as it is typed, like the verdict
 * they may hold back: `CommentHost` in `ReviewCommentForm.tsx` gives them.
 */
export const ReviewImagesContext = createContext<ReturnType<typeof useReviewImages> | undefined>(
  undefined,
);

/** The refusal of a verdict while the image of a comment cancelled is still being added. */
const STILL_ADDING = "An image is still being added: wait for it, then try again.";

/** Whether a page message is a verdict's refusal for images, which goes once they are dealt with. */
const forImages = (message?: { text: string }) =>
  message?.text === UNSENT || message?.text === STILL_ADDING;

/** A page's message without the verdict's refusal for the comment, as the comment closes. */
export const withoutCommentRefusal = <T extends { text: string }>(shown?: T) =>
  forImages(shown) ? undefined : shown;

/**
 * The images of a review's comments: they go into the comment being written, `field`, or a new
 * general comment when none is. A comment open with text not added yet holds the verdict, as one
 * linking images does, since a commit deletes the images no file links (R64, R70, R71, R16).
 */
export function useReviewImages(
  file: File,
  { draft, start, writing }: Pick<Draft, "draft" | "start" | "writing">,
  { setMessage }: Refusals,
  wide: boolean,
  field: ReturnType<typeof useTextField>,
) {
  const { change: setText, dirty, text } = field;
  // The comment that holds images, by its `writing`: they are in no file until it is added.
  const [linkedIn, setLinkedIn] = useState<number>();
  const linked = linkedIn === writing;
  // A verdict's refusal for images, which the form of that comment says on the phone.
  const [refused, setRefused] = useState<{ text: string; writing: number }>();
  const notice = refused?.writing === writing ? refused.text : undefined;
  const setNotice = (text: string | undefined) =>
    setRefused(text === undefined ? undefined : { text, writing });
  // The comment being written, and which one it is, read by the upload's callbacks: the images of
  // a run go into the comment it started for, never into the next one (R71).
  const draftRef = useRef(draft);
  const writingRef = useRef(writing);
  useLayoutEffect(() => {
    draftRef.current = draft;
    writingRef.current = writing;
  }, [draft, writing]);
  const runFor = useRef(0);
  const announce = useAnnounce();
  const images = useImageText({
    label: "the comment",
    onStart: useCallback(async () => {
      if (!draftRef.current) {
        start({ kind: "general" });
      }
      runFor.current = writingRef.current;
      setMessage((shown) => (shown?.text === STILL_ADDING ? undefined : shown));
      setRefused((shown) => (shown?.text === STILL_ADDING ? undefined : shown));
      return true;
    }, [setMessage, start]),
    // A comment cancelled, or replaced by another, during the upload keeps its text: the images
    // are in no file, and the next commit deletes them.
    onText: useCallback(
      (value: string, added: boolean) => {
        if (draftRef.current && runFor.current === writingRef.current) {
          setText(value);
          if (added) {
            setLinkedIn(writingRef.current);
          }
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

  return {
    /** Whether a page message stays: the refusal for an image still being added goes once it is in. */
    hides: (message: { text: string }) => message.text === STILL_ADDING && !images.busy,
    /**
     * Refuses a verdict while a comment not added yet holds text or links images, or an image is
     * still being added, and says why; resolves with whether it refused. A refusal leaves the
     * page's other errors, like a hook's, as they are (R70).
     */
    hold: () => {
      const reason =
        draft && (dirty || linked || (images.busy && runFor.current === writing))
          ? UNSENT
          : images.busy
            ? STILL_ADDING
            : undefined;
      if (!reason) {
        setNotice(undefined);
        return false;
      }
      announce(reason, "assertive");
      // On the phone, the comment's sheet lies over the page's end: the form says it, if open.
      if (wide || !draft) {
        setMessage({ ok: false, text: reason });
      } else {
        setMessage(withoutCommentRefusal);
        setNotice(reason);
      }
      return true;
    },
    images,
    /** The refusal the form says, which goes with its comment, or once its image is in. */
    notice: notice === STILL_ADDING && !images.busy ? undefined : notice,
  };
}
