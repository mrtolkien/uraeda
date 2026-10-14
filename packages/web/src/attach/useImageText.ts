import type { ClipboardEvent } from "react";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { AttachedView } from "uraeda-binding";
import { dropStyles } from "./DropHint.tsx";
import { followEdits, insertLinks } from "./insertLink.ts";
import { useAttach } from "./useAttach.ts";
import { useImageDrop } from "./useImageDrop.ts";

/** A text with links inserted, and its first link's alt text, to select. */
export type Linked = { text: string; selection: [number, number] };

/**
 * A text field of a workflow file that takes images: dropped anywhere on its page, pasted, or
 * picked. Each is saved by the core next to the file at `path`, and their links are inserted where
 * the cursor was when they came, one per line, the first one's alt text selected. What is typed
 * meanwhile is kept, before or after them as typed.
 */
export function useImageText({
  path,
  text,
  label,
  priority,
  initialSelection,
  onStart,
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
  /** Runs before the upload, like saving what was typed: `false` stops it. */
  onStart?: () => Promise<boolean>;
  /** Takes the text with the links, or the text as it is now when no image was added. */
  onText: (text: string, added: boolean) => void;
  /** Takes the text with the links when the file moved, a draft become a folder. */
  onMoved?: (moved: string, linked: Linked) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // A field never focused has no cursor the human chose: its images go at the end.
  const focused = useRef(false);
  const latest = useRef(text);
  latest.current = text;
  const { attach, busy, status } = useAttach({ path });
  const selection = useRef<[number, number] | undefined>(initialSelection);
  // Where the links of each upload under way go: the cursor at its start, moved by each edit since.
  const places = useRef(new Set<{ at: number; text: string }>());

  useLayoutEffect(() => {
    for (const place of places.current) {
      place.at = followEdits(place.text, text, place.at);
      place.text = text;
    }
  }, [text]);

  // The alt text is selected once the text with the links is drawn.
  useLayoutEffect(() => {
    const field = ref.current;
    if (selection.current && field && field.value === latest.current) {
      field.focus();
      field.setSelectionRange(...selection.current);
      selection.current = undefined;
    }
  });

  const addFiles = useCallback(
    async (files: File[]) => {
      const place = {
        at: focused.current && ref.current ? ref.current.selectionStart : latest.current.length,
        text: latest.current,
      };
      places.current.add(place);
      let results;
      try {
        if (onStart && !(await onStart())) {
          return;
        }
        results = await attach(files);
      } finally {
        places.current.delete(place);
      }
      const images = results.flatMap((result) => (result.ok ? [result.value as AttachedView] : []));
      const now = latest.current;
      if (images.length === 0) {
        onText(now, false);
        return;
      }
      const linked = insertLinks(
        now,
        followEdits(place.text, now, place.at),
        images.map((image) => image.link),
      );
      const moved = images.find((image) => image.moved)?.moved;
      if (moved && onMoved) {
        onMoved(moved, linked);
        return;
      }
      selection.current = linked.selection;
      onText(linked.text, true);
    },
    [attach, onMoved, onStart, onText],
  );

  const { isTarget, hint } = useImageDrop({ ref, priority, label, onFiles: addFiles });

  /** A paste of files attaches them, as pasted images, named by the core. */
  const onPaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const files = [...event.clipboardData.files];
      if (files.length === 0) {
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
        focused.current = true;
      },
      xstyle: isTarget ? dropStyles.target : undefined,
    },
    /** Attaches files given another way, like the picker's. */
    addFiles,
    /** The hint over the field while it is the drop's target. */
    hint,
    busy,
    status,
  };
}
