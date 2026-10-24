// The session page's draft: the composer's text and images, kept above the composer.
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ChatImage } from "uraeda-server/fate";
import { type DraftImage, draftImage, forgetPreviews } from "./attach/chatImages.ts";
import { withQuote } from "./sessions.ts";
import type { StoryComments } from "./stories.tsx";

/**
 * The composer's text and images, kept by the view while its session is created under it: a new
 * chat's or a feature's first message draws a new composer once sent.
 */
export type Draft = {
  /** Writes `quote` at the start of the text, in place of the one it wrote last, as `withQuote`. */
  ask: (quote: string) => void;
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

/**
 * Where a session's comments on the stories in its transcript go: on a line of their own at the end
 * of the composer's text, unsent, their unsaved text kept under `path`.
 */
export function storyCommentsInto({ setText }: Draft, path: string): StoryComments {
  return {
    path,
    save: async (_story, line) => {
      setText((now) => (now.trim() ? `${now.trimEnd()}\n${line}` : line));
      return undefined;
    },
  };
}

/** What a draft holds: its text, its images, and the quote asking wrote last. */
type Held = { images: ReadonlyArray<DraftImage>; inserted?: string; text: string };

/** A draft's store, which the composers drawing it read and write. */
type Store = {
  get: () => Held;
  set: (next: (held: Held) => Held) => void;
  subscribe: (listener: () => void) => () => void;
};

function store(): Store {
  let held: Held = { images: [], text: "" };
  const listeners = new Set<() => void>();
  return {
    get: () => held,
    set: (next) => {
      held = next(held);
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * The drafts kept for the life of the document, by their key: a feature's session composer, in
 * the round's column and on the session's page, holds the same one.
 */
const kept = new Map<string, Store>();

function keptStore(key: string): Store {
  let found = kept.get(key);
  if (!found) {
    found = store();
    kept.set(key, found);
  }
  return found;
}

function apply<T>(update: SetStateAction<T>, now: T): T {
  return typeof update === "function" ? (update as (now: T) => T)(now) : update;
}

/**
 * The composer's draft. With a `key`, it is kept for the life of the document, shared by every
 * view drawing it under that key, so that moving between them keeps the text and its images.
 * Without one, it goes with the view.
 */
export function useDraft(key?: string): Draft {
  const [local] = useState(store);
  const held = key === undefined ? local : keptStore(key);
  const { images, text } = useSyncExternalStore(held.subscribe, held.get);
  // The previews of images still being saved go with the view, unless the draft is kept.
  const shown = useRef(images);
  useLayoutEffect(() => {
    shown.current = images;
  });
  const isKept = key !== undefined;
  useEffect(
    () => () => {
      if (!isKept) {
        forgetPreviews(shown.current);
      }
    },
    [isKept],
  );
  const writes = useMemo(() => writesOf(held), [held]);
  return { ...writes, images, text };
}

/** A store's writes, the same for as long as the store is. */
function writesOf(held: Store): Pick<Draft, "ask" | "setImages" | "setText"> {
  return {
    ask: (quote) =>
      held.set((now) => ({
        ...now,
        inserted: quote,
        text: withQuote(now.text, quote, now.inserted),
      })),
    setImages: (update) => held.set((now) => ({ ...now, images: apply(update, now.images) })),
    setText: (update) => held.set((now) => ({ ...now, text: apply(update, now.text) })),
  };
}

/** The key of a feature's session draft, kept for the life of the document. */
export function featureDraftKey(repo: string, folder: string): string {
  return `${repo}:${folder}`;
}
