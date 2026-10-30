// The reason of an error, as the server logs it and a refused write's record shows it.

/** The codes of the core's refusals, which start their messages. */
export const REFUSAL_CODE = /^(refused|conflict|hook): /;

/** The reason of an error, its code taken off: for the server's log, or a refusal's record. */
export const reasonOf = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(REFUSAL_CODE, "");
