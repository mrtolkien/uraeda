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
import type { ChatImage, Trigger } from "uraeda-server/fate";
import { type DraftImage, draftImage, forgetPreviews } from "./attach/chatImages.ts";
import { withInserted } from "./RecommendedMessage.tsx";
import { withQuote } from "./sessions.ts";
import type { StoryComments } from "./stories.tsx";

/**
 * A workflow's run the draft's text starts with, a recommended message inserted or the message an
 * address hands over: its text, and the trigger, file, and step its run carries.
 */
export type DraftRun = { file?: string; step?: string; text: string; trigger: Trigger };

/**
 * The composer's text and images, kept by the view while its session is created under it: a new
 * chat's or a feature's first message draws a new composer once sent.
 */
export type Draft = {
  /**
   * Writes `quote` at the start of the text, in place of the one it wrote last, as `withQuote`.
   * Given the `address` asking for it, once: the draft took it already when the address comes back.
   */
  ask: (quote: string, address?: string) => void;
  /**
   * Puts the message the address hands over before the text, in place of the run's it holds, with
   * its run, once: the draft took it already when the address comes back, until it is sent or
   * emptied. The same message read again with another text replaces it, unless the human changed it.
   */
  handOver: (address: string, run: DraftRun) => void;
  images: ReadonlyArray<DraftImage>;
  /** The hand-over of `address` refused: the message it put in stays, without its run, as a chat. */
  refused: (address: string) => void;
  /** The workflow's run the text holds, until it is sent or emptied. */
  run?: DraftRun;
  setImages: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  /** Sets the run the text holds; none forgets the address whose message it took too. */
  setRun: (run: DraftRun | undefined) => void;
  setText: Dispatch<SetStateAction<string>>;
  text: string;
};

/** The composer's text, images, and run, held by the draft. */
export function composerDraft({ images, run, setImages, setRun, setText, text }: Draft) {
  return {
    images,
    onChange: setText,
    onImagesChange: setImages,
    onRun: setRun,
    value: text,
    ...(run === undefined ? {} : { run }),
  };
}

/** Puts a taken-back message's text and images back in the draft, before what it holds. */
export function takeBackInto({ setImages, setText }: Pick<Draft, "setImages" | "setText">) {
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

/**
 * What a draft holds: its text, its images, the quote asking wrote last, the run its text holds,
 * and the address whose message it took last.
 */
type Held = {
  address?: string;
  images: ReadonlyArray<DraftImage>;
  quote?: string;
  run?: DraftRun;
  text: string;
};

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
  const { images, run, text } = useSyncExternalStore(held.subscribe, held.get);
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
  return { ...writes, images, text, ...(run === undefined ? {} : { run }) };
}

/** A store's writes, the same for as long as the store is. */
function writesOf(held: Store): Omit<Draft, "images" | "run" | "text"> {
  return {
    ask: (quote, address) =>
      held.set((now) =>
        address !== undefined && now.address === address
          ? now
          : {
              ...now,
              ...(address === undefined ? {} : { address }),
              quote,
              text: withQuote(now.text, quote, now.quote),
            },
      ),
    handOver: (address, run) =>
      held.set((now) =>
        now.address !== address || isReadAgain(now, run)
          ? { ...now, address, run, text: withInserted(run.text, withoutRun(now)) }
          : now,
      ),
    refused: (address) =>
      held.set(({ run, ...now }) =>
        now.address === address ? now : { ...now, ...(run === undefined ? {} : { run }) },
      ),
    setImages: (update) => held.set((now) => ({ ...now, images: apply(update, now.images) })),
    setRun: (run) =>
      held.set(({ address, run: _, ...now }) =>
        run === undefined ? now : { ...now, run, ...(address === undefined ? {} : { address }) },
      ),
    setText: (update) => held.set((now) => ({ ...now, text: apply(update, now.text) })),
  };
}

/**
 * Whether `run` is the message the draft's address handed over, read again with another text or
 * step, as once the commits it was read before landed: it replaces the one the text starts with,
 * unless the human changed that one.
 */
function isReadAgain({ run: held, text }: Held, run: DraftRun): boolean {
  return (
    held !== undefined &&
    held.trigger === run.trigger &&
    held.file === run.file &&
    (held.text !== run.text || held.step !== run.step) &&
    text.startsWith(held.text)
  );
}

/** The draft's text without its run's message at its start, and the empty lines after it. */
function withoutRun({ run, text }: Held): string {
  return run !== undefined && text.startsWith(run.text)
    ? text.slice(run.text.length).replace(/^\n+/, "")
    : text;
}

/** The key of a feature's session draft, kept for the life of the document. */
export function featureDraftKey(repo: string, folder: string): string {
  return `${repo}:${folder}`;
}
