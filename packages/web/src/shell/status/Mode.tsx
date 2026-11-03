// The status line's section a: the Vim mode, as lualine names it, with its Lucide mark, while Vim's
// keys are on; NAV outside a field, where keys act on the page. With Vim off the line has none.
// And the mode's change in a field, read out once, politely, to a screen reader.
import { Icon } from "@astryxdesign/core/Icon";
import { useAnnounce } from "@astryxdesign/core/hooks";
import { useEffect, useRef } from "react";
import { type Mode as VimMode, useMode } from "../../fields/editor/modeStore.ts";
import { useVimOn } from "../../fields/editor/vim/load.ts";
import { Section, type Tone } from "./Sections.tsx";

type Shown = VimMode | "nav";

/** Each mode's name as lualine writes it, its mark, and its name as a screen reader says it. */
const MODES = {
  command: { icon: "uraeda:terminal", name: "COMMAND", spoken: "Command" },
  insert: { icon: "uraeda:pencil", name: "INSERT", spoken: "Insert" },
  nav: { icon: "uraeda:compass", name: "NAV", spoken: "Navigation" },
  normal: { icon: "uraeda:square", name: "NORMAL", spoken: "Normal" },
  replace: { icon: "uraeda:replace", name: "REPLACE", spoken: "Replace" },
  visual: { icon: "uraeda:square-dashed", name: "VISUAL", spoken: "Visual" },
  "visual-block": { icon: "uraeda:square-dashed", name: "V-BLOCK", spoken: "Visual block" },
  "visual-line": { icon: "uraeda:square-dashed", name: "V-LINE", spoken: "Visual line" },
} as const satisfies Record<Shown, { icon: `uraeda:${string}`; name: string; spoken: string }>;

/** The mode's block, at the line's start. */
export function ModeSection({ mode, tone }: { mode: Shown; tone: Tone }) {
  const { icon, name } = MODES[mode];
  return (
    <Section kind="a" tone={tone}>
      <Icon icon={icon} size="sm" />
      {name}
    </Section>
  );
}

/**
 * Reads out the Vim mode as it changes in a field, once, in a polite live region: not as a field
 * takes or leaves the focus, which the field's own name says, nor with Vim off. It draws nothing.
 */
export function ModeAnnouncer() {
  const { mode } = useMode();
  const isVimOn = useVimOn();
  const announce = useAnnounce();
  const before = useRef<Shown>(mode);
  useEffect(() => {
    const was = before.current;
    before.current = mode;
    if (isVimOn && was !== "nav" && mode !== "nav" && was !== mode) {
      announce(`${MODES[mode].spoken} mode`, "polite");
    }
  }, [announce, isVimOn, mode]);
  return null;
}
