import { availableParallelism } from "node:os";

/** Bound isolated workers in every configuration, including lightweight discovery. */
export const testWorkers = Math.min(4, availableParallelism());
