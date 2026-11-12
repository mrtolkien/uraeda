// Words every screen says the same way.

/**
 * A count and its noun, agreeing: "1 task", "2 tasks", "0 tasks"; `many` for a plural that is not
 * the noun and an "s": `plural(n, "branch", "branches")`.
 */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
