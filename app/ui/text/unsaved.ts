// The text typed in a field and not saved, kept on the device, as the React UI's `unsaved.ts`
// kept it in the browser: it comes back after a restart, and leaving a page that shows some asks
// first (`LeaveGuard`). An entry is one value of the device's store, `unsaved:<key>`, and the keys
// that hold one are listed under `unsaved`, so the app finds them all as it starts.
import { type Accessor, cleanup, computed, signal, untracked } from "nsh";
import { device } from "../../store/device";

/** A field's text typed and not saved. */
export type Unsaved = {
  /** When it was last typed, ISO 8601. */
  at: string;
  /** The saved text when the edit began: a restored text says whether the file changed since. */
  base: string;
  /** What a screen keeps with the text, as a review comment's lines: plain data. */
  extra?: unknown;
  /** What the field shows. */
  text: string;
};

/** How long unsaved text is kept: older entries go as the app starts. */
const KEPT_FOR = 30 * 24 * 60 * 60 * 1000;

const entryKey = (key: string) => `unsaved:${key}` as const;

/** The key of a field of a repository: `unsavedKey(repo, "<path>#notes")`. */
export function unsavedKey(repo: string, field: string): string {
  return `${repo}:${field}`;
}

/** Whether two texts differ by more than blanks at their ends, or at all when `exact`. */
export function differ(a: string, b: string, exact = false): boolean {
  return exact ? a !== b : a.trim() !== b.trim();
}

/** The unsaved text of a key, read as a signal. */
export function readUnsaved(key: string): Unsaved | undefined {
  return device.get(entryKey(key));
}

/** Keeps a field's unsaved text. */
export function writeUnsaved(key: string, value: Unsaved) {
  device.set(entryKey(key), value);
  const listed = untracked(() => device.get("unsaved") ?? []);
  if (!listed.includes(key)) {
    device.set("unsaved", [...listed, key]);
  }
}

/** Forgets a field's unsaved text: it was saved, discarded, or is the saved text again. */
export function dropUnsaved(key: string) {
  if (untracked(() => readUnsaved(key)) === undefined) {
    return;
  }
  device.set(entryKey(key), undefined);
  const listed = untracked(() => device.get("unsaved") ?? []);
  device.set(
    "unsaved",
    listed.filter((held) => held !== key),
  );
}

/** Drops what was last typed more than 30 days before `now`: once, as the app starts. */
export function pruneUnsaved(now: Date) {
  for (const key of untracked(() => device.get("unsaved") ?? [])) {
    const at = Date.parse(untracked(() => readUnsaved(key))?.at ?? "");
    if (Number.isNaN(at) || now.getTime() - at > KEPT_FOR) {
      dropUnsaved(key);
    }
  }
}

/** The fields drawn now, each with its key and its saved text: only their unsaved text is lost by leaving. */
const drawn = signal<ReadonlyArray<{ exact: boolean; key: string; saved: Accessor<string> }>>([]);

/** Whether a field drawn now holds text that differs from its saved text: what leaving loses. */
export const hasDrawnUnsaved: Accessor<boolean> = computed(() =>
  drawn().some(({ exact, key, saved }) => {
    const entry = readUnsaved(key);
    return entry !== undefined && differ(entry.text, saved(), exact);
  }),
);

/** What `unsavedText` gives a screen: a field's text, kept as it is typed. */
export type UnsavedText = {
  /** The text typed and not saved, if any, as kept. */
  entry: Accessor<Unsaved | undefined>;
  /** Keeps a text typed: one equal to the saved text keeps nothing. */
  change: (value: string) => void;
  /** Whether the text differs from the saved one. */
  dirty: Accessor<boolean>;
  /** Forgets the unsaved text: the saved text shows again. */
  discard: () => void;
  /** Says `value` was saved: its entry goes, unless the field changed since. */
  saved: (value: string) => void;
  /** What the field shows: the unsaved text, else the saved. */
  text: Accessor<string>;
};

/**
 * A field's text by its key, over its saved text: what it shows, its unsaved text kept on the
 * device as it is typed, and whether leaving loses some. Called as the screen's component renders:
 * the field is drawn until the component goes. `exact` counts blanks at the ends as an edit, as a
 * whole file's buffer does.
 */
export function unsavedText(
  key: string,
  saved: Accessor<string>,
  options: { exact?: boolean; extra?: () => unknown } = {},
): UnsavedText {
  const exact = options.exact === true;
  const field = { exact, key, saved };
  drawn.set([...untracked(drawn), field]);
  cleanup(() => drawn.set(untracked(drawn).filter((held) => held !== field)));
  // What was typed that leaves no entry, a blank after the saved text, while the saved text is the
  // one it was typed over.
  const typed = signal<{ over: string; text: string } | null>(null);
  const entry = () => readUnsaved(key);
  const shown = () => {
    const last = typed();
    return last !== null && last.over === saved() ? last.text : saved();
  };
  const text = () => entry()?.text ?? shown();
  return {
    change(value) {
      typed.set({ over: untracked(saved), text: value });
      if (!differ(value, untracked(saved), exact)) {
        dropUnsaved(key);
        return;
      }
      const extra = options.extra?.();
      writeUnsaved(key, {
        at: new Date().toISOString(),
        base: untracked(entry)?.base ?? untracked(saved),
        text: value,
        ...(extra === undefined ? {} : { extra }),
      });
    },
    dirty: () => differ(text(), saved(), exact),
    discard() {
      typed.set(null);
      dropUnsaved(key);
    },
    entry,
    saved(value) {
      typed.set({ over: untracked(saved), text: value });
      const now = untracked(entry);
      if (now?.text === value) {
        dropUnsaved(key);
      } else if (now !== undefined) {
        writeUnsaved(key, { ...now, base: value });
      }
    },
    text,
  };
}
