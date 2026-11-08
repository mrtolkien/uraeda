// One loaded version of an extension: what it registered, undone when it unloads, and the check
// every server API call makes so that a timer or listener left by an unloaded version is refused.

/** Prints a failure that must not stop the others, as the server prints its own. */
function report(name: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`uraeda: ${name}: ${message}\n`);
}

/**
 * The scope of one version of the extension `name`. The server API registers through `add`, and
 * checks with `check` before each call; `unload` runs the undos in reverse order, then refuses
 * every later call.
 */
export class Scope {
  readonly name: string;
  #live = true;
  readonly #undos: Array<() => void> = [];
  readonly #unloaded: Array<() => void> = [];

  constructor(name: string) {
    this.name = name;
  }

  /** Whether this version is still the loaded one. */
  isLive(): boolean {
    return this.#live;
  }

  /** Throws once this version is unloaded, naming the extension. */
  check(): void {
    if (!this.#live) {
      throw new Error(`${this.name}: this version of the extension was unloaded`);
    }
  }

  /** Keeps `undo`, the removal of something this version registered, to run when it unloads. */
  add(undo: () => void): void {
    this.check();
    this.#undos.push(undo);
  }

  /** Calls `fn` once this version is unloaded, after its undos. */
  onUnload(fn: () => void): void {
    this.check();
    this.#unloaded.push(fn);
  }

  /**
   * Undoes every registration, the last first, then marks the scope dead and calls its unload
   * listeners. An undo that throws is printed, and the others still run. Unloading twice does
   * nothing.
   */
  unload(): void {
    if (!this.#live) {
      return;
    }
    for (const undo of this.#undos.splice(0).reverse()) {
      try {
        undo();
      } catch (error) {
        report(this.name, error);
      }
    }
    this.#live = false;
    for (const fn of this.#unloaded.splice(0)) {
      try {
        fn();
      } catch (error) {
        report(this.name, error);
      }
    }
  }
}
