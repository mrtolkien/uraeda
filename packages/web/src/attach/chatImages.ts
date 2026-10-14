// The images of a chat message being written: added by the picker, a paste, or a drop, saved to
// the data folder one after the other, and shown as thumbnails until the message is sent.
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ChatImage } from "uraeda-server/fate";
import { IMAGE_REFUSALS, MAX_IMAGES } from "uraeda-server/limits";
import { useRepository } from "../routes.tsx";
import { chatImageSrc } from "../sessions.ts";
import { useServerFetch } from "./ServerFetch.tsx";
import { type AttachResult, useAttach } from "./useAttach.ts";

/**
 * An image of the composer's message: being saved, with the file's own preview, then saved, with
 * the chat image `POST /attach` returned. `name` labels its thumbnail.
 */
export type DraftImage = { image?: ChatImage; key: string; name: string; preview?: string };

/** Each draft image's key, unique across the composers a page draws in turn. */
let nextKey = 0;

/** A chat image back in the composer, like a taken-back message's. */
export function draftImage(image: ChatImage): DraftImage {
  nextKey += 1;
  return { image, key: `image-${nextKey}`, name: "Image" };
}

/** A file's image in the draft, being saved, shown by the file's own preview meanwhile. */
function draftImageOf(file: File): DraftImage {
  nextKey += 1;
  const preview = previewOf(file);
  return {
    key: `image-${nextKey}`,
    name: file.name || "pasted image",
    ...(preview === undefined ? {} : { preview }),
  };
}

/** A file's own image, shown while it is saved, or nothing where the browser makes none. */
function previewOf(file: File): string | undefined {
  try {
    return URL.createObjectURL(file);
  } catch {
    return undefined;
  }
}

function forget(preview: string | undefined) {
  if (preview !== undefined) {
    try {
      URL.revokeObjectURL(preview);
    } catch {
      // Nothing to free.
    }
  }
}

/** Frees the previews of images still being saved, as their page goes. */
export function forgetPreviews(images: ReadonlyArray<DraftImage>) {
  for (const image of images) {
    forget(image.preview);
  }
}

/**
 * The keys of the images removed while being saved, whose file is deleted once saved. Kept here,
 * not by a composer: the page draws a new composer once its session is created, and the upload
 * of the old one ends after.
 */
const discarded = new Set<string>();

/**
 * Runs `trim` each time the draft goes past 10 images, as a taken-back message's images go before
 * the draft's: past 10, the draft's last ones go.
 */
function useTrimToTen(over: boolean, trim: () => void) {
  const latest = useRef(trim);
  useLayoutEffect(() => {
    latest.current = trim;
  });
  useEffect(() => {
    if (over) {
      latest.current();
    }
  }, [over]);
}

/** The draft's images, how they change, and why none can be added now, if none can. */
type ChatImagesOptions = {
  images: ReadonlyArray<DraftImage>;
  onImagesChange: Dispatch<SetStateAction<ReadonlyArray<DraftImage>>>;
  refusedWith?: string;
};

/**
 * The composer's images, kept by the page with its text: added by the picker, a paste, or a drop,
 * saved one after the other to the data folder, and removed with their files. Refuses images to an
 * agent not available or that cannot read them, to the workflow's message, and past 10.
 */
export function useChatImages({ images, onImagesChange, refusedWith }: ChatImagesOptions) {
  const fetch = useServerFetch();
  const repo = useRepository();
  const attach = useAttach({ chat: true });
  // The images as last set, read by files added before React draws the ones added just before.
  const current = useRef(images);
  useLayoutEffect(() => {
    current.current = images;
  });
  // Uploads go one after the other, in the order the files came (R49).
  const queue = useRef(Promise.resolve());
  // Whether the status is shown: a sent message takes the last "Added" away with it.
  const [shown, setShown] = useState(true);

  const deleteImage = (image: ChatImage) => {
    void fetch(chatImageSrc(repo, image), { method: "DELETE" }).catch(() => undefined);
  };

  /** Takes an image out of the draft, and returns it. */
  const drop = (key: string) => {
    const gone = current.current.find((image) => image.key === key);
    current.current = current.current.filter((image) => image.key !== key);
    onImagesChange((now) => now.filter((image) => image.key !== key));
    forget(gone?.preview);
    return gone;
  };

  const remove = (key: string) => {
    const gone = drop(key);
    if (gone?.image) {
      deleteImage(gone.image);
    } else if (gone) {
      // Still being saved: deleted once saved.
      discarded.add(key);
    }
  };

  const settle = (added: DraftImage, result: AttachResult) => {
    forget(added.preview);
    const removed = discarded.delete(added.key);
    if (!result.ok) {
      drop(added.key);
      return;
    }
    const image = result.value as ChatImage;
    if (removed) {
      deleteImage(image);
      return;
    }
    const saved = { image, key: added.key, name: added.name };
    current.current = current.current.map((one) => (one.key === added.key ? saved : one));
    onImagesChange((now) => now.map((one) => (one.key === added.key ? saved : one)));
  };

  const addFiles = (files: Array<File>) => {
    setShown(true);
    if (refusedWith !== undefined) {
      attach.show(refusedWith, true);
      return;
    }
    const taken = files.slice(0, Math.max(0, MAX_IMAGES - current.current.length));
    const added = taken.map(draftImageOf);
    current.current = [...current.current, ...added];
    onImagesChange((now) => [...now, ...added]);
    // The batch in one run, as a field's: its refusal stays shown over the images added after it.
    if (taken.length > 0) {
      queue.current = queue.current.then(async () => {
        await attach.attach(taken, undefined, (result, index) => settle(added[index], result));
      });
    }
    if (taken.length < files.length) {
      // Shown once the images taken are saved, so their statuses do not hide it.
      queue.current = queue.current.then(() => attach.show(IMAGE_REFUSALS.tooManyImages, true));
    }
  };

  useTrimToTen(images.length > MAX_IMAGES, () => {
    for (const image of current.current.slice(MAX_IMAGES)) {
      remove(image.key);
    }
    setShown(true);
    attach.show(IMAGE_REFUSALS.tooManyImages, true);
  });

  return {
    addFiles,
    remove,
    status: shown ? attach.status : undefined,
    /** Hides the status, as a sent message's images leave the composer. */
    sent: () => setShown(false),
  };
}
