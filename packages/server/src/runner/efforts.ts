/** The names for people of the efforts agents share, by their IDs. */
const NAMES: Record<string, string> = {
  high: "High",
  low: "Low",
  max: "Max",
  medium: "Medium",
  ultra: "Ultra",
  xhigh: "Extra high",
};

/** An effort's name for people: "Extra high" for `xhigh`, any other ID as given. */
export function effortName(id: string): string {
  return Object.hasOwn(NAMES, id) ? NAMES[id]! : id;
}
