// The session page's draft: the composer's text and images, kept above the composer.
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ChatImage } from "uraeda-server/fate";
import { type DraftImage, draftImage, forgetPreviews } from "./attach/chatImages.ts";

/**
 * The composer's text and images, kept by the view while its session is created under it: a new
 * chat's or a feature's first message draws a new composer once sent.
 */
export type Draft = {
  images: ReadonlyArray<DraftImage>;
  setImages: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  setText: Dispatch<SetStateAction<string>>;
  text: string;
};

/** The composer's text and images, held by the draft. */
export function composerDraft({ images, setImages, setText, text }: Draft) {
  return { images, onChange: setText, onImagesChange: setImages, value: text };
}

/** Puts a taken-back message's text and images back in the draft, before what it holds. */
export function takeBackInto({ setImages, setText }: Draft) {
  return (back: string, images: ReadonlyArray<ChatImage>) => {
    if (back.trim()) {
      setText((now) => (now.trim() ? `${back}\n${now}` : back));
    }
    if (images.length > 0) {
      setImages((now) => [...images.map(draftImage), ...now]);
    }
  };
}

export function useDraft(): Draft {
  const [text, setText] = useState("");
  const [images, setImages] = useState<ReadonlyArray<DraftImage>>([]);
  // The previews of images still being saved go with the page.
  const kept = useRef(images);
  useLayoutEffect(() => {
    kept.current = images;
  });
  useEffect(() => () => forgetPreviews(kept.current), []);
  return { images, setImages, setText, text };
}
