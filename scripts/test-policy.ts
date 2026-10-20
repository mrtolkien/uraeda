import { availableParallelism } from "node:os";

/** Bound isolated workers in every configuration, including lightweight discovery. */
export const testWorkers = Math.min(4, availableParallelism());

/**
 * A test's time bound where it builds a git repository and reads it through the binding: Vitest's
 * 5 s default is a load bound there, not a hang detector. Shared by the packages' configurations
 * and fast's focused projects, so a case passes in both or in neither.
 */
export const gitTestTimeout = 20_000;

/** The scripts' cases start a nested Vitest or fast-check, themselves bounded at 120 s. */
export const scriptsTestTimeout = 130_000;
