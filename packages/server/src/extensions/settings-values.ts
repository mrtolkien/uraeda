// The extensions' settings as the host keeps them between reads of the settings file: every
// repository's, and each listed repository's own, and which extensions' `on` or settings changed
// since the last read, to reload them.
import type { Extension } from "uraeda-binding";
import type { Binding } from "../fate/context.ts";
import type { Runtimes } from "../runner/runtimes.ts";
import type { BuiltIns } from "./builtins.ts";
import type { Contributions } from "./contributions.ts";
import { reportFor } from "./events.ts";
import type { Loader } from "./loader.ts";
import { GLOBAL, printOf } from "./settings-print.ts";

/** An extension whose `on`, or whose settings, changed at a read. */
export type Changed = { name: string; onChanged: boolean; valuesChanged: boolean };

/** Each extension's settings: every repository's under "", then each repository's by name. */
export class SettingsValues {
  readonly #binding: Pick<Binding, "extensionSettings">;
  readonly #configDir: string;
  #values = new Map<string, Map<string, Record<string, unknown>>>();
  #prints = new Map<string, string>();

  constructor(binding: Pick<Binding, "extensionSettings">, configDir: string) {
    this.#binding = binding;
    this.#configDir = configDir;
  }

  /** The extension's settings in a repository, or every repository's for null. */
  get(extension: string, repository: string | null): Record<string, unknown> {
    const values = this.#values.get(extension);
    return { ...(values?.get(repository ?? GLOBAL) ?? values?.get(GLOBAL) ?? {}) };
  }

  /**
   * Reads the settings of `extensions` for every repository and each of `repositories`, keeps
   * them, and gives the extensions whose `on` (against `before`) or settings changed.
   */
  async read(
    extensions: ReadonlyArray<Extension>,
    before: ReadonlyMap<string, Extension>,
    repositories: ReadonlyArray<string>,
  ): Promise<Array<Changed>> {
    const values = new Map<string, Map<string, Record<string, unknown>>>();
    for (const extension of extensions) {
      const byRepository = new Map<string, Record<string, unknown>>();
      if (extension.settings.length > 0) {
        for (const repository of [GLOBAL, ...repositories]) {
          const json = await this.#binding.extensionSettings(
            this.#configDir,
            extension.name,
            repository || null,
          );
          byRepository.set(repository, JSON.parse(json) as Record<string, unknown>);
        }
      }
      values.set(extension.name, byRepository);
    }
    const changed = [];
    for (const extension of extensions) {
      const print = printOf(values.get(extension.name)!);
      const old = before.get(extension.name);
      const onChanged =
        old !== undefined && (old.onAll !== extension.onAll || `${old.on}` !== `${extension.on}`);
      const known = this.#prints.get(extension.name);
      const valuesChanged = known !== undefined && known !== print;
      if (onChanged || valuesChanged) {
        changed.push({ name: extension.name, onChanged, valuesChanged });
      }
      this.#prints.set(extension.name, print);
    }
    this.#values = values;
    return changed;
  }
}

/** What reloading the changed extensions reaches. */
export type ReloadDeps = {
  builtIns: Pick<BuiltIns, "reload">;
  changed: (extension: string, record: string) => void;
  contributions: Pick<Contributions, "records">;
  extensions: ReadonlyMap<string, Extension>;
  loader: Pick<Loader, "reload"> | undefined;
  runtimes: Pick<Runtimes, "changed" | "get">;
};

/**
 * Reloads the extensions whose `on` or settings changed: their records are sent again, yours
 * reload, a built-in's server part only for its settings, and the runtimes' list once for all.
 */
export function reloadChanged(changed: ReadonlyArray<Changed>, deps: ReloadDeps): void {
  let runtimes = false;
  for (const { name, onChanged, valuesChanged } of changed) {
    runtimes ||= onChanged && deps.runtimes.get(name) !== undefined;
    for (const record of deps.contributions.records(name)) {
      deps.changed(name, record);
    }
    const extension = deps.extensions.get(name)!;
    if (!extension.isBuiltIn) {
      void deps.loader?.reload(name).catch((error: unknown) => reportFor(name, error));
    } else if (valuesChanged) {
      deps.builtIns.reload(name);
    }
  }
  if (runtimes) {
    deps.runtimes.changed();
  }
}
