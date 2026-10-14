import type { ClipboardEvent } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { AttachedView } from "uraeda-binding";
import { dropStyles } from "./DropHint.tsx";
import { type Edit, editBetween, followEdit, insertLinks } from "./insertLink.ts";
import { type AttachStatus, useAttach } from "./useAttach.ts";
import { useImageDrop } from "./useImageDrop.ts";

/** A text with links inserted, and its first link's alt text, to select. */
export type Linked = { text: string; selection: [number, number] };

/** The run of uploads under way: the path they go to, and what they inserted so far. */
type Run = { path: string; added: boolean; selection?: [number, number] };

/** Moves places by an edit, as `followEdit` says. */
function shift(places: Iterable<{ at: number }>, edit: Edit, after = false) {
  for (const place of places) {
    place.at = followEdit(place.at, edit, after);
  }
}

/** The refusal shown when the text could not be saved before an upload. */
const NOT_SAVED = "Your text is not saved: the image was not added.";

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
export function useImageText({
  path,
  text,
  label,
  priority,
  initialSelection,
  initialStatus,
  onStart,
  onLinks,
  onText,
  onMoved,
}: {
  /** The markdown file the images are attached to. */
  path: string;
  /** The field's text now. */
  text: string;
  /** The drop hint's name for the field, "Drop to add to <label>". */
  label: string;
  /** The field's rank among its page's drop targets when none holds the focus. */
  priority: number;
  /** A selection to make once the field is drawn, as a moved draft's new editor does. */
  initialSelection?: [number, number];
  /** A status to show first, as a moved draft's new editor shows the one its old page left. */
  initialStatus?: AttachStatus;
  /** Runs before a run's first upload, like saving what was typed: `false` stops that upload. */
  onStart?: () => Promise<boolean>;
  /** Takes the text with links while more files wait: shown, not saved yet. */
  onLinks?: (text: string) => void;
  /** Takes the text once a run ended, with its links when `added`. */
  onText: (text: string, added: boolean) => void;
  /** Takes the text with the links once a run ended with the file moved, and the last status. */
  onMoved?: (moved: string, linked: Linked, status?: AttachStatus) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // The element last focused: a field never focused since it was drawn has no cursor the human
  // chose, and its images go at the end. A field drawn again, as after the preview, is new.
  const focused = useRef<HTMLTextAreaElement | null>(null);
  const latest = useRef(text);
  latest.current = text;
  const { attach, status, show, lastStatus } = useAttach({ path }, initialStatus);
  const selection = useRef<[number, number] | undefined>(initialSelection);
  // Where the links of each batch waiting or uploading go: the cursor when it came, moved by each
  // edit since.
  const places = useRef(new Set<{ at: number }>());
  // The text the places are positions of.
  const seen = useRef(text);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const run = useRef<Run | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const callbacks = useRef({ onStart, onLinks, onText, onMoved, path });
  callbacks.current = { onStart, onLinks, onText, onMoved, path };

  // Each edit moves the places after it, placed by the field's caret once it was typed.
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
  }, [text]);

  // The alt text is selected once the text with the links is drawn; a field not drawn, as while
  // the preview shows, drops the selection, which would take the focus later.
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

  /** Uploads a batch in its turn, and inserts its links at its place. */
  const upload = useCallback(
    async (files: File[], place: { at: number }) => {
      if (!run.current) {
        const { onStart } = callbacks.current;
        if (onStart && !(await onStart())) {
          show(NOT_SAVED, true);
          return;
        }
        run.current = { path: callbacks.current.path, added: false };
      }
      const current = run.current;
      const results = await attach(files, current.path);
      const images = results.flatMap((result) => (result.ok ? [result.value as AttachedView] : []));
      current.path = images.find((image) => image.moved)?.moved ?? current.path;
      if (images.length === 0) {
        return;
      }
      places.current.delete(place);
      const now = latest.current;
      const linked = insertLinks(
        now,
        place.at,
        images.map((image) => image.link),
      );
      // The batches after this one, at the same place, go after its links.
      shift(
        places.current,
        { start: place.at, removed: 0, inserted: linked.text.length - now.length },
        true,
      );
      seen.current = linked.text;
      latest.current = linked.text;
      current.added = true;
      current.selection = linked.selection;
      selection.current = linked.selection;
      if (pending.current > 1) {
        callbacks.current.onLinks?.(linked.text);
      }
    },
    [attach, show],
  );

  /** Ends the run once its last batch is done. */
  const end = useCallback(() => {
    const ended = run.current;
    run.current = undefined;
    setBusy(false);
    if (!ended) {
      return;
    }
    const now = latest.current;
    const { onMoved, onText, path } = callbacks.current;
    if (ended.path !== path && onMoved) {
      onMoved(
        ended.path,
        { text: now, selection: ended.selection ?? [now.length, now.length] },
        lastStatus(),
      );
      return;
    }
    onText(now, ended.added);
  }, [lastStatus]);

  const addFiles = useCallback(
    (files: File[]) => {
      const field = ref.current;
      const place = {
        at: field && focused.current === field ? field.selectionStart : latest.current.length,
      };
      places.current.add(place);
      pending.current += 1;
      setBusy(true);
      const done = queue.current
        .then(() => upload(files, place))
        .finally(() => {
          places.current.delete(place);
          pending.current -= 1;
          if (pending.current === 0) {
            end();
          }
        });
      queue.current = done.catch(() => {});
      return done;
    },
    [end, upload],
  );

  const { isTarget, hint } = useImageDrop({
    ref,
    priority,
    label,
    onFiles: (files) => void addFiles(files),
  });

  /**
   * A paste of files, and no text, attaches them, as pasted images, named by the core. A paste
   * from an office suite carries a picture of the text with the text: the text is pasted (R51).
   */
  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = [...event.clipboardData.files];
      if (files.length === 0 || event.clipboardData.getData("text/plain").trim()) {
        return;
      }
      event.preventDefault();
      void addFiles(files.map((file) => new File([file], "", { type: file.type })));
    },
    [addFiles],
  );

  return {
    /**
     * Spread on the field's `TextArea`: its ref, its paste and focus, and its outline as the drop's
     * target.
     */
    fieldProps: {
      ref,
      onPaste,
      onFocus: () => {
        focused.current = ref.current;
      },
      xstyle: isTarget ? dropStyles.target : undefined,
    },
    /** Attaches files given another way, like the picker's. */
    addFiles,
    /** The hint over the field while it is the drop's target. */
    hint,
    /** Whether files wait or upload. */
    busy,
    status,
  };
}
