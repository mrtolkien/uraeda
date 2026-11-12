// What the app keeps on a device, on Native Shell's `Storage`: the choices of the person using it
// there, like a theme or a width, and the text they have not saved. Everything else is the
// server's. `Storage` answers with promises, so the store reads it once, as the app starts, and
// then answers at once, from memory.
import { type Accessor, type Signal, signal, Storage, untracked } from "nsh";
import type { Declarations } from "../extensions/page";
import type { Arrangement } from "../ui/layout/arrangement";
import type { ThemeChoice } from "../ui/theme";
import type { Unsaved } from "../ui/text/unsaved";
import type { Fonts, ThemeSource } from "../ui/tokens";

/**
 * Everything the app keeps on a device: one line per value, its name in the storage and what it
 * holds, which must be plain data. A feature adds its line here and nowhere else, so a name taken
 * twice does not compile. A family of values, one per file or per field, is a pattern:
 * `[draft: \`unsaved:${string}\`]: Draft`.
 */
export type DeviceKeys = {
  /** The mode the device shows, and the theme picked for each mode: `pickTheme` reads it. */
  theme: ThemeChoice;
  /** The theme last shown, which the app draws from its first frame, before the server answers. */
  "theme.shown": ThemeSource;
  /** The font picked for each part of the UI, a bundled font's id: `applyFonts` reads it. */
  fonts: Partial<Fonts>;
  /** A field's text typed and not saved, by the field's key (`app/ui/text/unsaved.ts`). */
  [entry: `unsaved:${string}`]: Unsaved;
  /** What an extension's page declared, by its name, for its version (`app/extensions/declared.tsx`). */
  [declared: `declared:${string}`]: { version: number; declarations: Declarations };
  /** The frame: the side stack's width and fold, and the rail's fold (`app/ui/layout/`). */
  frame: { rail?: boolean; side?: boolean; sideWidth?: number };
  /** How the human arranged each kind of place's panes, by its subject's kind (`app/ui/layout/`). */
  layouts: Readonly<Record<string, Arrangement>>;
  /** How the priorities show, as columns or one list (`app/screens/priorities/`). */
  "priorities.view": "columns" | "list";
  /** The decisions' order in their list (`app/screens/decisions/`). */
  "decisions.sort": "changed-desc" | "changed-asc" | "title";
  /** Whether the desktop's notifications are on, once asked (`app/screens/shell/Notifications.tsx`). */
  notifications: boolean;
  /** Where the human is in a round of questions, by its repository and id (`app/screens/round/`). */
  [round: `round.at:${string}`]: string;
  /** The width a story and a mockup show at, once picked (`app/screens/preview/`). */
  "preview.width": { mockup?: "phone" | "desktop" | "fit"; story?: "phone" | "desktop" | "fit" };
};

/** The values of a device, by the names of `Keys`. */
export type DeviceStore<Keys> = {
  /**
   * Whether the storage refused a value, past the 5 MB an app may keep: the value stays until the
   * app closes, and is lost then.
   */
  readonly full: Accessor<boolean>;
  /** Writes now every value that waits for its rest: the app leaves the front, or closes. */
  flush(): void;
  /** The value of `key`, `undefined` when the device keeps none: who reads it is told of a change. */
  get<K extends keyof Keys & string>(key: K): Keys[K] | undefined;
  /**
   * The keys that start with `prefix` and hold a value now, read from the values themselves: a
   * family of values, one per field, has no list of its own to keep in step.
   */
  keys(prefix: string): ReadonlyArray<string>;
  /**
   * Reads what the device keeps, once, before the app draws: until then `get` answers `undefined`.
   * A value set meanwhile wins over the one kept.
   */
  load(): Promise<void>;
  /**
   * Keeps `value` under `key`, or nothing with `undefined`: read back at once, written after. A
   * key's writes go one at a time, each with the value the key holds as it starts, so the storage
   * ends on the last value set, however its answers come. With `rest`, the write waits until the
   * key has not been set for that many milliseconds, as a text typed is written once per pause.
   */
  set<K extends keyof Keys & string>(
    key: K,
    value: Keys[K] | undefined,
    options?: { rest?: number },
  ): void;
};

/** What a stored text holds: nothing when it is not a value the app wrote. */
function parse(stored: string): unknown {
  try {
    return JSON.parse(stored);
  } catch {
    return undefined;
  }
}

/** What the store needs of a storage: Native Shell's `Storage`, or a test's. */
export type DeviceStorage = Pick<typeof Storage, "keys" | "getItem" | "setItem" | "removeItem">;

/** A store of the values `Keys` names, over the app's storage, or `storage`. */
export function deviceStore<Keys>(storage: DeviceStorage = Storage): DeviceStore<Keys> {
  const values = new Map<string, Signal<unknown>>();
  /** The keys set since the store was made, which `load` leaves as they are. */
  const written = new Set<string>();
  /** The keys whose last value the storage refused. */
  const refused = new Set<string>();
  /** The keys with a write on its way, and whether the key was set again since it began. */
  const writing = new Map<string, { again: boolean }>();
  /** The keys whose write waits for its rest. */
  const resting = new Map<string, ReturnType<typeof setTimeout>>();
  const full = signal(false);

  function cell(key: string): Signal<unknown> {
    let value = values.get(key);
    if (value === undefined) {
      value = signal<unknown>(undefined);
      values.set(key, value);
    }
    return value;
  }

  /** Writes what `key` holds now, after the write of it on its way, if any. */
  function write(key: string) {
    const rest = resting.get(key);
    if (rest !== undefined) clearTimeout(rest);
    resting.delete(key);
    const going = writing.get(key);
    if (going !== undefined) {
      going.again = true;
      return;
    }
    const state = { again: false };
    writing.set(key, state);
    const value = untracked(cell(key));
    const settled = (kept: boolean) => {
      writing.delete(key);
      if (state.again) {
        write(key);
        return;
      }
      if (kept) {
        refused.delete(key);
      } else {
        refused.add(key);
      }
      full.set(refused.size > 0);
    };
    (value === undefined
      ? storage.removeItem(key)
      : storage.setItem(key, JSON.stringify(value))
    ).then(
      () => settled(true),
      () => settled(false),
    );
  }

  return {
    flush() {
      for (const key of resting.keys()) write(key);
    },
    full,
    get<K extends keyof Keys & string>(key: K) {
      return cell(key)() as Keys[K] | undefined;
    },
    keys(prefix) {
      return [...values]
        .filter(([key, value]) => key.startsWith(prefix) && untracked(value) !== undefined)
        .map(([key]) => key);
    },
    async load() {
      const keys = await storage.keys();
      await Promise.all(
        keys.map(async (key) => {
          const stored = await storage.getItem(key);
          if (stored !== null && !written.has(key)) {
            cell(key).set(parse(stored));
          }
        }),
      );
    },
    set(key, value, options) {
      written.add(key);
      cell(key).set(value);
      if (options?.rest === undefined) {
        write(key);
        return;
      }
      const waiting = resting.get(key);
      if (waiting !== undefined) clearTimeout(waiting);
      resting.set(
        key,
        setTimeout(() => write(key), options.rest),
      );
    },
  };
}

/** What the app keeps on this device. `device.load()` runs once, before the app is mounted. */
export const device = deviceStore<DeviceKeys>();
