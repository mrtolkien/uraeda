/** How far discovery researches a proposal: its `discovery` frontmatter field, `high` without it. */
export const LEVELS = ["low", "medium", "high"] as const;
export type Level = (typeof LEVELS)[number];

const FRONTMATTER = /^---\r?\n([\s\S]*?\r?\n)?---\r?\n/;
const FIELD = /^discovery:[^\S\r\n]*["']?(\w+)/m;

/** The level a proposal's text asks for: `high` when it names none, or none of the levels. */
export function discoveryOf(text: string): Level {
  const value = FRONTMATTER.exec(text)?.[1]?.match(FIELD)?.[1];
  return LEVELS.find((level) => level === value) ?? "high";
}

/**
 * The text with its `discovery` field set: the field's line replaced, with any comment after it
 * kept, or added at the end of the frontmatter. A text without frontmatter gets one.
 */
export function withDiscovery(text: string, level: Level): string {
  const front = FRONTMATTER.exec(text);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  if (!front) {
    return `---${newline}discovery: ${level}${newline}---${newline}${newline}${text}`;
  }
  const yaml = front[1] ?? "";
  const updated = /^discovery:/m.test(yaml)
    ? yaml.replace(/^discovery:[^\S\r\n]*[^\s#]*/m, `discovery: ${level}`)
    : `${yaml}discovery: ${level}${newline}`;
  return `---${newline}${updated}---${newline}${text.slice(front[0].length)}`;
}
