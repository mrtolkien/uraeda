// The jobs a change is being opened for: an acceptance in flight is the job's run still working, but
// the session is not in its folder yet, nor does its agent work, so neither the open-change check nor
// the session's status says so. The acceptance and the scheduler share one `Busy` (R18).

/** The job and repository (the main checkout's path) that an acceptance holds. */
const keyOf = (job: string, repository: string) => `${job}\0${repository}`;

/** The jobs busy with an acceptance, by job name and repository root. */
export class Busy {
  readonly #held = new Map<string, number>();

  /** Marks the job busy in the repository: gives the call that ends it. */
  enter(job: string, repository: string): () => void {
    const key = keyOf(job, repository);
    this.#held.set(key, (this.#held.get(key) ?? 0) + 1);
    let left = false;
    return () => {
      if (left) {
        return;
      }
      left = true;
      const count = (this.#held.get(key) ?? 1) - 1;
      if (count === 0) {
        this.#held.delete(key);
      } else {
        this.#held.set(key, count);
      }
    };
  }

  /** Whether an acceptance of the job's run holds it in the repository. */
  has(job: string, repository: string): boolean {
    return this.#held.has(keyOf(job, repository));
  }
}
