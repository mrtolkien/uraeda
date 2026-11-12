// The text typed in a field and not saved, kept on the device: it comes back after a restart, and
// leaving a page that shows some asks first (`LeaveGuard`). The app never loses a word typed, so
// one rule holds for every field: a save or a send takes the text as it is when the human asks, a
// snapshot, and never touches what they type while the server answers.
//
// - `save` is for a field over a saved text, as a file's or a note's: the field keeps its text;
//   once saved, the snapshot is the saved text, and what was typed since stays, unsaved, over it.
// - `send` is for a field that starts from nothing, as a message's or a new note's: the snapshot
//   leaves the field at once, which is free for the next; refused, it comes back before what was
//   typed since.
//
// Both say what happened to their caller, so what follows a refusal stops. An entry is one value
// of the device's store, `unsaved:<key>`, found from the store's own keys: no list beside them.
// It is written once the typing pauses, and at once when a text is sent or saved.
import { type Accessor, cleanup, computed, effect, signal, untracked } from "nsh";
import { device } from "../../store/device";
import { refusalOf } from "../controls/sent";

/** A field's text typed and not saved. */
export type Unsaved = {
  /** When it was last typed, ISO 8601. */
  at: string;
  /** The saved text when the edit began: a restored text says whether the file changed since. */
  base: string;
  /** What a screen keeps with the text, as a review comment's lines: plain data. */
  extra?: unknown;
  /**
   * A text sent and not answered yet, and what goes between it and the text typed since if it
   * comes back: kept so an app closed while it sends loses neither.
   */
  sent?: { gap: string; text: string };
  /** What the field shows. */
  text: string;
};

/** What a save or a send did. */
export type Submitted<T> =
  | { ok: true; value: T }
  /** Why it was refused; `null` when nothing was sent, another send being on its way. */
  | { ok: false; why: string | null };

/** What goes with a text sent, as its images: taken as the text is, put back if it is refused. */
export type Taken<A> = {
  /** Puts `taken` back, before what was added since. */
  putBack: (taken: A) => void;
  /** Takes what is held now, leaving nothing. */
  take: () => A;
};

/** How long unsaved text is kept: older entries go as the app starts. */
const KEPT_FOR = 30 * 24 * 60 * 60 * 1000;

/** How long the typing rests before the device writes the text, in milliseconds. */
const REST = 300;

const PREFIX = "unsaved:";
const entryKey = (key: string) => `${PREFIX}${key}` as const;

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

const peek = (key: string) => untracked(() => readUnsaved(key));

/** Keeps an entry: once the typing pauses, or `now` for what a deliberate act changed. */
function write(key: string, value: Unsaved, now = false) {
  device.set(entryKey(key), value, now ? undefined : { rest: REST });
}

/** Forgets a field's unsaved text, for good. */
function dropUnsaved(key: string) {
  if (peek(key) !== undefined) device.set(entryKey(key), undefined);
}

/**
 * Keeps `text` as the unsaved text of `key`, over `base`: nothing when it is the saved text and no
 * text of the key is on its way. `hold` keeps it even then, while a save is on its way: the saved
 * text is about to change, and what was typed must outlive it, whichever of the record and the
 * save's answer comes first.
 */
function keep(
  key: string,
  text: string,
  base: string,
  exact: boolean,
  extra?: unknown,
  hold = false,
) {
  const held = peek(key);
  if (!hold && !differ(text, base, exact) && held?.sent === undefined) {
    dropUnsaved(key);
    return;
  }
  write(key, {
    at: new Date().toISOString(),
    base: held?.base ?? base,
    text,
    ...(extra === undefined ? {} : { extra }),
    ...(held?.sent === undefined ? {} : { sent: held.sent }),
  });
}

/**
 * Says the text `saved` of `key` reached the server: its entry goes, unless the field was typed in
 * since, whose text stays, unsaved, over `saved`. For a save made away from the field, as a
 * round's submit saves the comments left typed: a field saves with its own `save`.
 */
export function settleUnsaved(key: string, saved: string, exact = false) {
  const held = peek(key);
  if (held === undefined) return;
  if (differ(held.text, saved, exact)) {
    write(key, { ...held, base: saved }, true);
  } else if (held.sent === undefined) {
    dropUnsaved(key);
  }
}

/**
 * Changes a draft's text from outside its field, as a quote put at its start or a message taken
 * back: `change` gets what it holds and gives what it should hold.
 */
export function amendUnsaved(key: string, change: (text: string) => string) {
  const held = peek(key);
  keep(key, change(held?.text ?? ""), held?.base ?? "", false);
}

/** Moves a field's unsaved text to another key, as a file renamed takes its text along. */
export function moveUnsaved(from: string, to: string) {
  const held = peek(from);
  if (held === undefined || from === to) return;
  write(to, held, true);
  dropUnsaved(from);
}

/** A text sent, joined with what was typed since. */
const joined = (sent: NonNullable<Unsaved["sent"]>, since: string) =>
  since.trim() === "" ? sent.text : `${sent.text}${sent.gap}${since}`;

/**
 * Once, as the app starts: drops what was last typed more than 30 days before `now`, and puts a
 * text that was on its way when the app closed back in its field, before what was typed after it.
 */
export function restoreUnsaved(now: Date) {
  for (const stored of device.keys(PREFIX)) {
    const key = stored.slice(PREFIX.length);
    const held = peek(key);
    const at = Date.parse(held?.at ?? "");
    if (held === undefined || Number.isNaN(at) || now.getTime() - at > KEPT_FOR) {
      device.set(entryKey(key), undefined);
    } else if (held.sent !== undefined) {
      const { sent, ...rest } = held;
      write(key, { ...rest, text: joined(sent, held.text) }, true);
    }
  }
}

/** The fields drawn now, each with its key and its saved text: only their unsaved text is lost by leaving. */
const drawn = signal<
  ReadonlyArray<{ exact: boolean; key: Accessor<string>; saved: Accessor<string> }>
>([]);

/** Whether a field drawn now holds text that differs from its saved text: what leaving loses. */
export const hasDrawnUnsaved: Accessor<boolean> = computed(() =>
  drawn().some(({ exact, key, saved }) => {
    const entry = readUnsaved(key());
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
  /** Forgets the unsaved text, as the human asks: the saved text shows again. */
  discard: () => void;
  /** Whether a save or a send is on its way. */
  pending: Accessor<boolean>;
  /**
   * Saves the text as it is now through `run`, which rejects with the server's words. The field
   * stays as it is, and can be typed in: once saved, what was typed since stays unsaved, over the
   * text saved. Saves go one after the other, and the same text asked twice is one save, unless
   * `kind` tells them apart: a save over a file changed on disk never joins an ordinary one.
   */
  save: <T>(run: (text: string) => Promise<T>, kind?: string) => Promise<Submitted<T>>;
  /**
   * Sends the text as it is now through `run`, with what `held` holds: both leave at once, and the
   * field is free for the next. Refused, they come back, before what was typed and added since.
   * One at a time: a send while another is on its way sends nothing. For a field that starts from
   * nothing, as a message's.
   */
  send: <T, A = undefined>(
    run: (text: string, attached: A) => Promise<T>,
    held?: Taken<A>,
  ) => Promise<Submitted<T>>;
  /** What the field shows: the unsaved text, else the saved. */
  text: Accessor<string>;
};

/**
 * A field's text by its key, over its saved text: what it shows, its unsaved text kept on the
 * device as it is typed, and whether leaving loses some. Called as the screen's component renders:
 * the field is drawn until the component goes. `exact` counts blanks at the ends as an edit, as a
 * whole file's buffer does; `guards: false` is a draft that leaving does not ask about, as a
 * message's, which waits in its place; `gap` is what stands between a refused text and what was
 * typed since, a blank line unless given.
 */
export function unsavedText(
  key: string | Accessor<string>,
  saved: Accessor<string>,
  options: { exact?: boolean; extra?: () => unknown; gap?: string; guards?: boolean } = {},
): UnsavedText {
  const keyNow = typeof key === "function" ? key : () => key;
  const exact = options.exact === true;
  if (options.guards !== false) {
    const field = { exact, key: keyNow, saved };
    drawn.set([...untracked(drawn), field]);
    cleanup(() => drawn.set(untracked(drawn).filter((held) => held !== field)));
  }
  // What was typed last, while the saved text is the one it was typed over, or is that text but
  // for blanks: the field shows it, though it leaves no entry.
  const typed = signal<{ key: string; over: string; text: string } | null>(null);
  // What a save wrote, until the record says so too: nothing is unsaved meanwhile.
  const kept = signal<{ key: string; over: string; text: string } | null>(null);
  effect(() => {
    const [now, at] = [saved(), keyNow()];
    const held = untracked(kept);
    if (held !== null && (held.over !== now || held.key !== at)) kept.set(null);
  });
  const saves = signal(0);
  let chain: Promise<unknown> = Promise.resolve();
  const queued: Array<{
    done: Promise<Submitted<unknown>>;
    key: string;
    kind: string;
    text: string;
  }> = [];

  const entry = () => readUnsaved(keyNow());
  /** The saved text, as far as the field knows: what its last save wrote, else the record's. */
  const settled = () => {
    const held = kept();
    return held !== null && held.key === keyNow() && held.over === saved() ? held.text : saved();
  };
  const shown = () => {
    const last = typed();
    return last !== null &&
      last.key === keyNow() &&
      (last.over === saved() || !differ(last.text, saved(), exact))
      ? last.text
      : saved();
  };
  const text = () => entry()?.text ?? shown();

  return {
    change(value) {
      const at = untracked(keyNow);
      typed.set({ key: at, over: untracked(saved), text: value });
      keep(at, value, untracked(settled), exact, options.extra?.(), untracked(saves) > 0);
    },
    dirty: () => differ(text(), settled(), exact),
    discard() {
      typed.set(null);
      keep(untracked(keyNow), untracked(settled), untracked(settled), exact);
    },
    entry,
    pending: () => saves() > 0 || entry()?.sent !== undefined,
    save<T>(run: (text: string) => Promise<T>, kind = "") {
      const at = untracked(keyNow);
      const snapshot = untracked(text);
      const same = queued.find(
        (one) => one.key === at && one.kind === kind && one.text === snapshot,
      );
      if (same !== undefined) return same.done as Promise<Submitted<T>>;
      saves.update((count) => count + 1);
      const done = chain.then(async (): Promise<Submitted<T>> => {
        try {
          const value = await run(snapshot);
          const here = untracked(keyNow) === at;
          // What was typed while the save was on its way is in the entry, even typed back to the
          // text saved before: it stays, an edit over the snapshot.
          const shows = here ? untracked(text) : snapshot;
          settleUnsaved(at, snapshot, exact);
          if (here) {
            kept.set({ key: at, over: untracked(saved), text: snapshot });
            // The field keeps the text it shows, until the record holds it too.
            if (peek(at) === undefined) {
              typed.set({ key: at, over: untracked(saved), text: shows });
            }
          }
          return { ok: true, value };
        } catch (error) {
          return { ok: false, why: refusalOf(error) };
        } finally {
          queued.splice(
            queued.findIndex((one) => one.done === done),
            1,
          );
          saves.update((count) => count - 1);
          // The last save answered: an entry kept only while it was on its way, typed back to the
          // text it began over, goes.
          const held = peek(at);
          if (
            untracked(saves) === 0 &&
            held !== undefined &&
            held.sent === undefined &&
            !differ(held.text, held.base, exact)
          ) {
            dropUnsaved(at);
          }
        }
      });
      queued.push({ done, key: at, kind, text: snapshot });
      chain = done;
      return done;
    },
    async send<T, A = undefined>(
      run: (text: string, attached: A) => Promise<T>,
      held?: Taken<A>,
    ): Promise<Submitted<T>> {
      const at = untracked(keyNow);
      const before = peek(at);
      if (before?.sent !== undefined) return { ok: false, why: null };
      const sent = { gap: options.gap ?? "\n\n", text: untracked(text) };
      const attached = held?.take() as A;
      typed.set(null);
      write(at, { at: new Date().toISOString(), base: before?.base ?? "", sent, text: "" }, true);
      /** The entry without the text sent, holding `since`: nothing when that is the saved text. */
      const answered = (since: string) => {
        const { sent: _, ...rest } = peek(at) ?? { at: "", base: "", text: "" };
        if (differ(since, rest.base, exact)) {
          write(at, { ...rest, at: new Date().toISOString(), text: since }, true);
        } else {
          device.set(entryKey(at), undefined);
        }
      };
      try {
        const value = await run(sent.text, attached);
        answered(peek(at)?.text ?? "");
        return { ok: true, value };
      } catch (error) {
        answered(joined(sent, peek(at)?.text ?? ""));
        held?.putBack(attached);
        return { ok: false, why: refusalOf(error) };
      }
    },
    text,
  };
}
