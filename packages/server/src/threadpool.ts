// Imported first by `main.ts`, before anything uses libuv's thread pool, which reads its size once:
// each read and write of the core's binding holds one of its threads, 4 by default, so a start, its
// live updates, and a page's read waited for each other. A size set outside is kept.
import { availableParallelism } from "node:os";

/** The pool's size: one thread per core, at least 8, as the binding's calls mostly wait on git. */
export function poolSize(cores: number): string {
  return String(Math.min(Math.max(cores, 8), 64));
}

process.env.UV_THREADPOOL_SIZE ??= poolSize(availableParallelism());
