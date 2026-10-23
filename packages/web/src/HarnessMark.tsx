// A harness's mark, by the kind of agent a session runs on: Codicons' drawing of its mark where
// Codicons has one, and Lucide's `bot` for any other kind, never an empty space (the UI look).
import { Icon, type IconSize } from "@astryxdesign/core/Icon";

/** The harnesses Codicons draws a mark for, by their kind, with their icon and name. */
const MARKED: Record<string, { icon: HarnessIcon; name: string }> = {
  claude: { icon: "uraeda:harness-claude", name: "Claude Code" },
  codex: { icon: "uraeda:harness-openai", name: "Codex" },
};

/** The names of the harnesses drawn by the generic glyph, by their kind. */
const NAMES: Record<string, string> = { fake: "Fake agent", pi: "Pi" };

type HarnessIcon = "uraeda:harness-agent" | "uraeda:harness-claude" | "uraeda:harness-openai";

/** A harness's icon and name, by its kind: an unknown kind is named by the kind itself. */
export function harnessMark(kind: string): { icon: HarnessIcon; name: string } {
  return Object.hasOwn(MARKED, kind)
    ? MARKED[kind]!
    : { icon: "uraeda:harness-agent", name: Object.hasOwn(NAMES, kind) ? NAMES[kind]! : kind };
}

/**
 * A harness's mark, named by the harness. Decorative beside text or in a link that already says
 * the harness's name, which `isDecorative` leaves to them.
 */
export function HarnessMark({
  isDecorative = false,
  kind,
  size = "sm",
}: {
  isDecorative?: boolean;
  kind: string;
  size?: IconSize;
}) {
  const { icon, name } = harnessMark(kind);
  return (
    <Icon color="secondary" icon={icon} {...(isDecorative ? {} : { label: name })} size={size} />
  );
}
