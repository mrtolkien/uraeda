import type { ClipboardEvent, RefObject } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { AttachedView } from "uraeda-binding";
import { dropStyles } from "./DropHint.tsx";
import { type Edit, editBetween, followEdit, insertLinks } from "./insertLink.ts";
import { type AttachStatus, useAttach } from "./useAttach.ts";
import { useImageDrop } from "./useImageDrop.ts";

/** A text with links inserted, and its first link's alt text, to select. */
export type Linked = { selection: [number, number]; text: string };

/** The run of uploads under way: the path they go to, and what they inserted so far. */
type Run = { added: boolean; path: string; selection?: [number, number] };

/** Moves places by an edit, as `followEdit` says. */
function shift(places: Iterable<{ at: number }>, edit: Edit, after = false) {
  for (const place of places) {
    place.at = followEdit(place.at, edit, after);
  }
}

/** The refusal shown when the text could not be saved before an upload. */
const NOT_SAVED = "Your text is not saved: the image was not added.";

/**
 * Where the links of each batch waiting or uploading go: the cursor when it came, moved by each
 * edit since, placed by the field's caret once it was typed. `seen` is the text they are
 * positions of.
 */
function usePlaces(ref: RefObject<HTMLTextAreaElement | null>, text: string) {
  const places = useRef(new Set<{ at: number }>());
  const seen = useRef(text);
  useLayoutEffect(() => {
    if (text === seen.current) {
      return;
    }
    const field = ref.current;
    const caret =
      field &&
      document.activeElement === field &&
      field.value === text &&
      field.selectionStart === field.selectionEnd
        ? field.selectionStart
        : undefined;
    shift(places.current, editBetween(seen.current, text, caret));
    seen.current = text;
  }, [ref, text]);
  return { places, seen };
}

/**
 * The alt text to select once the text with the links is drawn; a field not drawn, as while the
 * preview shows, drops the selection, which would take the focus later.
 */
function useSelectAfterDraw(
  ref: RefObject<HTMLTextAreaElement | null>,
  latest: RefObject<string>,
  initial?: [number, number],
) {
  const selection = useRef<[number, number] | undefined>(initial);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!selection.current) {
      return;
    }
    if (!field) {
      selection.current = undefined;
    } else if (field.value === latest.current) {
      field.focus();
      field.setSelectionRange(...selection.current);
      selection.current = undefined;
    }
  });
  return selection;
}

/** The options of `useImageText`. */
type ImageTextOptions = {
  /** A selection to make once the field is drawn, as a moved draft's new editor does. */
  initialSelection?: [number, number];
  /** A status to show first, as a moved draft's new editor shows the one its old page left. */
  initialStatus?: AttachStatus;
  /** The drop hint's name for the field, "Drop to add to <label>". */
  label: string;
  /** Takes the text with links while more files wait: shown, not saved yet. */
  onLinks?: (text: string) => void;
  /** Takes the text with the links once a run ended with the file moved, and the last status. */
  onMoved?: (moved: string, linked: Linked, status?: AttachStatus) => void;
  /** Runs before a run's first upload, like saving what was typed: `false` stops that upload. */
  onStart?: () => Promise<boolean>;
  /**
   * Takes the text once a run ended, with its links when `added`. `false` says the field did not
   * take it, as a comment closed during the run: the alt text is not selected then.
   */
  onText: (text: string, added: boolean) => boolean | void;
  /** The markdown file the images are attached to. */
  path: string;
  /** The field's rank among its page's drop targets when none holds the focus. */
  priority: number;
  /** The field's text now. */
  text: string;
};

/** What a field's runs read and move: its element, its text, and where links go. */
type Field = {
  callbacks: RefObject<
    Pick<ImageTextOptions, "onLinks" | "onMoved" | "onStart" | "onText" | "path">
  >;
  /** The element last focused, whose cursor places the links. */
  focused: RefObject<HTMLTextAreaElement | null>;
  latest: RefObject<string>;
  places: RefObject<Set<{ at: number }>>;
  ref: RefObject<HTMLTextAreaElement | null>;
  seen: RefObject<string>;
  selection: RefObject<[number, number] | undefined>;
};

/** Inserts a batch's links at its place, moving the batches after it at the same place. */
function insertBatch(field: Field, place: { at: number }, links: Array<string>, run: Run) {
  field.places.current.delete(place);
  const now = field.latest.current;
  const linked = insertLinks(now, place.at, links);
  shift(
    field.places.current,
    { inserted: linked.text.length - now.length, removed: 0, start: place.at },
    true,
  );
  field.seen.current = linked.text;
  field.latest.current = linked.text;
  run.added = true;
  run.selection = linked.selection;
  field.selection.current = linked.selection;
  return linked.text;
}

/**
 * The text a run hands over as it ends: to its new page when the file moved, else to the field.
 * Returns whether the field took it.
 */
function handOver(field: Field, ended: Run, status: AttachStatus | undefined) {
  const now = field.latest.current;
  const { onMoved, onText, path } = field.callbacks.current;
  if (ended.path !== path && onMoved) {
    onMoved(
      ended.path,
      { selection: ended.selection ?? [now.length, now.length], text: now },
      status,
    );
    return true;
  }
  return onText(now, ended.added) !== false;
}

/** Selects no alt text once drawn: the field did not take the links. */
function forgetSelection(field: Field) {
  field.selection.current = undefined;
}

/**
 * The runs of uploads of a field: files given while others upload wait their turn, in one run,
 * which starts with `onStart` and ends once its last file is done.
 */
function useRuns(field: Field, attaching: ReturnType<typeof useAttach>) {
  const { attach, lastStatus, show } = attaching;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const run = useRef<Run | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  /** Uploads a batch in its turn, and inserts its links at its place. */
  const upload = async (files: Array<File>, place: { at: number }) => {
    if (!run.current) {
      const { onStart, path } = field.callbacks.current;
      if (onStart && !(await onStart())) {
        show(NOT_SAVED, true);
        return;
      }
      run.current = { added: false, path };
    }
    const current = run.current;
    const results = await attach(files, current.path);
    const images = results.flatMap((result) => (result.ok ? [result.value as AttachedView] : []));
    current.path = images.find((image) => image.moved)?.moved ?? current.path;
    if (images.length > 0) {
      const text = insertBatch(
        field,
        place,
        images.map((image) => image.link),
        current,
      );
      if (pending.current > 1) {
        field.callbacks.current.onLinks?.(text);
      }
    }
  };

  /** Ends the run once its last batch is done. */
  const end = () => {
    const ended = run.current;
    run.current = undefined;
    setBusy(false);
    if (ended && !handOver(field, ended, lastStatus())) {
      forgetSelection(field);
    }
  };

  const addFiles = (files: Array<File>) => {
    const element = field.ref.current;
    const at =
      element && field.focused.current === element
        ? element.selectionStart
        : field.latest.current.length;
    const place = { at };
    field.places.current.add(place);
    pending.current += 1;
    setBusy(true);
    const done = queue.current
      .then(() => upload(files, place))
      .finally(() => {
        field.places.current.delete(place);
        pending.current -= 1;
        if (pending.current === 0) {
          end();
        }
      });
    queue.current = done.catch(() => {});
    return done;
  };

  /**
   * Resolves once no file waits or uploads, and the run's end has handed its text over: what must
   * hold the links, like a submit, waits for it.
   */
  const settled = useCallback(async () => {
    let current: Promise<void>;
    do {
      current = queue.current;
      await current;
    } while (current !== queue.current);
  }, []);

  return { addFiles, busy, settled };
}

/**
 * The files a paste attaches, as pasted images, named by the core: none when it holds text, as a
 * paste from an office suite carries a picture of the text with the text, which is pasted (R51).
 */
function pastedImages(event: ClipboardEvent<HTMLTextAreaElement>) {
  const files = [...event.clipboardData.files];
  if (files.length === 0 || event.clipboardData.getData("text/plain").trim()) {
    return undefined;
  }
  return files.map((file) => new File([file], "", { type: file.type }));
}

/**
 * A text field of a workflow file that takes images: dropped anywhere on its page, pasted, or
 * picked. Each is saved by the core next to the file at `path`, and their links are inserted where
 * the cursor was when they came, one per line, the first one's alt text selected. What is typed
 * meanwhile is kept, before or after them as typed.
 *
 * Files given while others upload wait their turn, in one run: a run starts with `onStart`, and
 * ends once the last of its files is done, with `onText`, or `onMoved` when the file moved, a draft
 * become a folder, whose later files went to its new path.
 */
export function useImageText(options: ImageTextOptions) {
  const { initialSelection, initialStatus, label, path, priority, text } = options;
  const ref = useRef<HTMLTextAreaElement>(null);
  // A field never focused since it was drawn has no cursor the human chose, and its images go at
  // the end. A field drawn again, as after the preview, is new.
  const focused = useRef<HTMLTextAreaElement | null>(null);
  const latest = useRef(text);
  const callbacks = useRef(options);
  useLayoutEffect(() => {
    latest.current = text;
    callbacks.current = options;
  });
  const attaching = useAttach({ path }, initialStatus);
  const selection = useSelectAfterDraw(ref, latest, initialSelection);
  const { places, seen } = usePlaces(ref, text);
  const field = { callbacks, focused, latest, places, ref, seen, selection };
  const { addFiles, busy, settled } = useRuns(field, attaching);
  const { hint, isTarget } = useImageDrop({
    label,
    onFiles: (files) => void addFiles(files),
    priority,
    ref,
  });

  return {
    /** Attaches files given another way, like the picker's. */
    addFiles,
    /** Whether files wait or upload. */
    busy,
    /**
     * Spread on the field's `TextArea`: its ref, its paste and focus, and its outline as the drop's
     * target.
     */
    fieldProps: {
      onFocus: () => {
        focused.current = ref.current;
      },
      onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => {
        const files = pastedImages(event);
        if (files) {
          event.preventDefault();
          void addFiles(files);
        }
      },
      ref,
      xstyle: isTarget ? dropStyles.target : undefined,
    },
    /** The hint over the field while it is the drop's target. */
    hint,
    settled,
    status: attaching.status,
  };
}
