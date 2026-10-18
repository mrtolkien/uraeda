/** The joints between two letters, as the core reads them. */
const JOINTS = [", and ", " and ", ", "];

/** The marks ending the letters: the comment follows them. */
const END_MARKS = [":", ",", "."];

/** The text after the first of `prefixes` that `text` starts with, if one. */
function after(text: string, prefixes: ReadonlyArray<string>) {
  const prefix = prefixes.find((p) => text.startsWith(p));
  return prefix === undefined ? undefined : text.slice(prefix.length);
}

/**
 * The option letters an answer starts with, as the core reads a saved answer: "B and C: ..." is
 * B and C, "C, we want ..." is C, and "C but ..." is none. A comment saved with no letter picked
 * that starts like this reads back as those letters picked.
 */
export function startingLetters(answer: string, options: ReadonlyArray<string>): Array<string> {
  const run: Array<string> = [];
  let longest = 0;
  let rest = answer.trim();
  while (rest && options.includes(rest[0])) {
    run.push(rest[0]);
    const next = rest.slice(1);
    if (next === "" || after(next, END_MARKS) !== undefined) {
      longest = run.length;
    }
    const joined = after(next, JOINTS);
    if (joined === undefined) {
      break;
    }
    rest = joined;
  }
  return run.slice(0, longest);
}
