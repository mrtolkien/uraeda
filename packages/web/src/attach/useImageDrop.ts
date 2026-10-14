import { type RefObject, useEffect, useRef, useSyncExternalStore } from "react";

/** A field that takes the files dropped on its page. */
export type DropField = {
  /** The field's element: it is the target while it holds the focus, and is outlined. */
  ref: RefObject<HTMLElement | null>;
  /** Its rank among the page's fields when none holds the focus: the highest takes the drop. */
  priority: number;
  onFiles(files: File[]): void;
  /** What the hint names, "Drop to add to <label>". */
  label: string;
};

/** The registered fields, each in a box its hook updates as it draws. */
const fields = new Set<{ current: DropField }>();
/** The field a file dragged over the page would go to, while one is. */
let target: { current: DropField } | undefined;
/** Drag enters minus leaves, over the page's elements: 0 once the drag left the window. */
let depth = 0;
const listeners = new Set<() => void>();

/**
 * The focused field, else the one of the highest priority: a field registers while its page shows
 * it, drawn or not yet, like an editor showing its preview.
 */
function pick() {
  const all = [...fields];
  const active = document.activeElement;
  return (
    all.find((field) => active && field.current.ref.current?.contains(active)) ??
    all.sort((a, b) => b.current.priority - a.current.priority)[0]
  );
}

function update(next: { current: DropField } | undefined) {
  if (next !== target) {
    target = next;
    for (const listener of listeners) {
      listener();
    }
  }
}

const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

/**
 * Listens on the window for files dragged over the page and dropped. The browser's default of a
 * file drop, opening the file in place of the app, is cancelled on every page, with or without a
 * field. Native events: no Astryx component makes a page a drop target, an Astryx gap the plan
 * lists.
 */
function listen() {
  window.addEventListener("dragenter", (event) => {
    if (carriesFiles(event)) {
      event.preventDefault();
      depth += 1;
      update(pick());
    }
  });
  window.addEventListener("dragover", (event) => {
    if (carriesFiles(event)) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = target ? "copy" : "none";
      }
    }
  });
  window.addEventListener("dragleave", (event) => {
    if (carriesFiles(event)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        update(undefined);
      }
    }
  });
  window.addEventListener("dragend", () => {
    depth = 0;
    update(undefined);
  });
  window.addEventListener("drop", (event) => {
    if (!carriesFiles(event)) {
      return;
    }
    // A field that took the drop itself, like the composer's input, cancelled it already.
    const handled = event.defaultPrevented;
    event.preventDefault();
    const field = target ?? pick();
    depth = 0;
    update(undefined);
    const files = [...(event.dataTransfer?.files ?? [])];
    if (!handled && field && files.length > 0) {
      field.current.onFiles(files);
    }
  });
}

if (typeof window !== "undefined") {
  listen();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Registers a field as a target of the files dropped anywhere on its page. While a file is dragged
 * over the window, the target is the focused field, else the registered field with the highest
 * priority: it is outlined, with the hint "Drop to add to <label>". Returns whether the field is
 * the target now, and the hint to show then.
 */
export function useImageDrop(field: DropField): { isTarget: boolean; hint?: string } {
  const box = useRef(field);
  box.current = field;
  useEffect(() => {
    fields.add(box);
    return () => {
      fields.delete(box);
      if (target === box) {
        update(undefined);
      }
    };
  }, []);
  const isTarget = useSyncExternalStore(subscribe, () => target === box);
  return isTarget ? { isTarget, hint: `Drop to add to ${field.label}` } : { isTarget };
}
