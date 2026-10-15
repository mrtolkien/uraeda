import { type RefObject, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

/** A field that takes the files dropped on its page. */
export type DropField = {
  /** What the hint names, "Drop to add to <label>". */
  label: string;
  onFiles(files: Array<File>): void;
  /** Its rank among the page's fields when none holds the focus: the highest takes the drop. */
  priority: number;
  /** The field's element: it is the target while it holds the focus, and is outlined. */
  ref: RefObject<HTMLElement | null>;
  /** Whether it takes images: `false` for a file the core takes none for, never the target. */
  takes?: boolean;
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
  const all = [...fields].filter((field) => field.current.takes !== false);
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

/** The window's drag and drop listeners, which move the drop's target and hand it the files. */
const onEnter = (event: DragEvent) => {
  if (carriesFiles(event)) {
    event.preventDefault();
    depth += 1;
    update(pick());
  }
};
const onOver = (event: DragEvent) => {
  if (carriesFiles(event)) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = target ? "copy" : "none";
    }
  }
};
const onLeave = (event: DragEvent) => {
  if (carriesFiles(event)) {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      update(undefined);
    }
  }
};
const onEnd = () => {
  depth = 0;
  update(undefined);
};
const onDrop = (event: DragEvent) => {
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
};

/**
 * Listens on the window for files dragged over the page and dropped, until the returned function
 * stops it. The browser's default of a file drop, opening the file in place of the app, is
 * cancelled on every page, with or without a field. Native events: no Astryx component makes a page
 * a drop target, an Astryx gap the plan lists.
 */
function listen() {
  const events = [
    ["dragenter", onEnter],
    ["dragover", onOver],
    ["dragleave", onLeave],
    ["dragend", onEnd],
    ["drop", onDrop],
  ] as const;
  for (const [type, listener] of events) {
    window.addEventListener(type, listener);
  }
  return () => {
    for (const [type, listener] of events) {
      window.removeEventListener(type, listener);
    }
  };
}

/** How many mounted guards want the window's listeners, and how to stop them once none does. */
let guards = 0;
let stop: (() => void) | undefined;

/**
 * Keeps the window's drag and drop listeners while mounted: the first guard adds them, the last one
 * removes them, so a module replaced while the app runs, as in development, leaves none behind. The
 * app mounts one for as long as it runs: a drop outside every field never leaves the app.
 */
export function useDropGuard() {
  useEffect(() => {
    guards += 1;
    if (guards === 1) {
      stop = listen();
    }
    return () => {
      guards -= 1;
      if (guards === 0) {
        stop?.();
        stop = undefined;
      }
    };
  }, []);
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
export function useImageDrop(field: DropField): { hint?: string; isTarget: boolean } {
  const box = useRef(field);
  useLayoutEffect(() => {
    box.current = field;
  });
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
  return isTarget ? { hint: `Drop to add to ${field.label}`, isTarget } : { isTarget };
}
