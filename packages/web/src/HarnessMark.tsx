// A harness's mark, by the kind of agent a session runs on: the icon its runtime declares, and its
// name. A kind no runtime registered here, as a session's of a runtime since removed, falls back on
// the marks below: Codicons' drawing of its mark where Codicons has one, a neutral glyph drawn for
// Uraeda for Pi, and Lucide's `bot` for any other kind, never an empty space (the UI look).
import { Icon, type IconSize } from "@astryxdesign/core/Icon";
import { type ComponentProps, Suspense } from "react";
import { type Runtime, useRuntimes } from "./runtimes.ts";

/** An icon's name, as Astryx's `Icon` takes it. */
type IconName = ComponentProps<typeof Icon>["icon"];

type IconColor = ComponentProps<typeof Icon>["color"];

/** The harnesses with a mark of their own, by their kind, with their icon and name. */
const MARKED: Record<string, { icon: IconName; name: string }> = {
  claude: { icon: "uraeda:harness-claude", name: "Claude Code" },
  codex: { icon: "uraeda:harness-openai", name: "Codex" },
  pi: { icon: "uraeda:harness-pi", name: "Pi" },
};

/** The names of the harnesses drawn by the generic glyph, by their kind. */
const NAMES: Record<string, string> = { fake: "Fake agent" };

/**
 * A harness's icon and name, by its kind: its runtime's, among `runtimes`, else its mark above; an
 * unknown kind is named by the kind itself.
 */
export function harnessMark(
  kind: string,
  runtimes: ReadonlyArray<Runtime> = [],
): { icon: IconName; name: string } {
  const runtime = runtimes.find((each) => each.kind === kind);
  if (runtime && runtime.icon !== "") {
    // An icon name of the app's set, as the runtime's extension declares it.
    return { icon: runtime.icon as IconName, name: runtime.name };
  }
  return Object.hasOwn(MARKED, kind)
    ? MARKED[kind]!
    : { icon: "uraeda:harness-agent", name: Object.hasOwn(NAMES, kind) ? NAMES[kind]! : kind };
}

/** `harnessMark` over the runtimes registered here. */
export function useHarnessMark(kind: string): { icon: IconName; name: string } {
  return harnessMark(kind, useRuntimes());
}

type MarkProps = { color?: IconColor; isDecorative?: boolean; kind: string; size?: IconSize };

function Mark({
  color = "secondary",
  icon,
  isDecorative,
  name,
  size,
}: MarkProps & { icon: IconName; name: string }) {
  return <Icon color={color} icon={icon} {...(isDecorative ? {} : { label: name })} size={size} />;
}

function RuntimeMark(props: MarkProps) {
  return <Mark {...props} {...useHarnessMark(props.kind)} />;
}

/**
 * A harness's mark, named by the harness. Decorative beside text or in a link that already says
 * the harness's name, which `isDecorative` leaves to them. Its fallback mark shows while the
 * runtimes are read.
 */
export function HarnessMark({ color, isDecorative = false, kind, size = "sm" }: MarkProps) {
  const props = { ...(color === undefined ? {} : { color }), isDecorative, kind, size };
  return (
    <Suspense fallback={<Mark {...props} {...harnessMark(kind)} />}>
      <RuntimeMark {...props} />
    </Suspense>
  );
}
