// What the app keeps on a device, on Native Shell's `Storage`: the choices of the person using it
// there, like a theme or a width, and the text they have not saved. Everything else is the
// server's. `Storage` answers with promises, so the store reads it once, as the app starts, and
// then answers at once, from memory.
import { type Accessor, type Signal, signal, Storage } from "nsh";
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
  /** The keys of the fields that hold unsaved text (`app/ui/text/unsaved.ts`). */
  unsaved: ReadonlyArray<string>;
  /** A field's text typed and not saved, by the field's key. */
  [entry: `unsaved:${string}`]: Unsaved;
};

/** The values of a device, by the names of `Keys`. */
export type DeviceStore<Keys> = {
  /**
   * Whether the storage refused a value, past the 5 MB an app may keep: the value stays until the
   * app closes, and is lost then.
   */
  readonly full: Accessor<boolean>;
  /** The value of `key`, `undefined` when the device keeps none: who reads it is told of a change. */
  get<K extends keyof Keys & string>(key: K): Keys[K] | undefined;
  /**
   * Reads what the device keeps, once, before the app draws: until then `get` answers `undefined`.
   * A value set meanwhile wins over the one kept.
   */
  load(): Promise<void>;
  /** Keeps `value` under `key`, or nothing with `undefined`: read back at once, written after. */
  set<K extends keyof Keys & string>(key: K, value: Keys[K] | undefined): void;
};

/** What a stored text holds: nothing when it is not a value the app wrote. */
function parse(stored: string): unknown {
  try {
    return JSON.parse(stored);
  } catch {
    return undefined;
  }
}

/** A store of the values `Keys` names, over the app's storage. */
export function deviceStore<Keys>(): DeviceStore<Keys> {
  const values = new Map<string, Signal<unknown>>();
  /** The keys set since the store was made, which `load` leaves as they are. */
  const written = new Set<string>();
  /** The keys whose last value the storage refused. */
  const refused = new Set<string>();
  const full = signal(false);

  function cell(key: string): Signal<unknown> {
    let value = values.get(key);
    if (value === undefined) {
      value = signal<unknown>(undefined);
      values.set(key, value);
    }
    return value;
  }

  function wrote(key: string, kept: boolean) {
    if (kept) {
      refused.delete(key);
    } else {
      refused.add(key);
    }
    full.set(refused.size > 0);
  }

  return {
    full,
    get<K extends keyof Keys & string>(key: K) {
      return cell(key)() as Keys[K] | undefined;
    },
    async load() {
      const keys = await Storage.keys();
      await Promise.all(
        keys.map(async (key) => {
          const stored = await Storage.getItem(key);
          if (stored !== null && !written.has(key)) {
            cell(key).set(parse(stored));
          }
        }),
      );
    },
    set(key, value) {
      written.add(key);
      cell(key).set(value);
      const write =
        value === undefined ? Storage.removeItem(key) : Storage.setItem(key, JSON.stringify(value));
      write.then(
        () => wrote(key, true),
        () => wrote(key, false),
      );
    },
  };
}

/** What the app keeps on this device. `device.load()` runs once, before the app is mounted. */
export const device = deviceStore<DeviceKeys>();
