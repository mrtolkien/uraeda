// Sample 2: a pane at rest beside a focused one, each with its border round its title, then every
// other state a pane has, and a field at rest under a focused one.
import { View } from "nsh";
import { field } from "./controls";
import { pane, type PaneOptions, tag } from "./parts";
import type { Tokens } from "../../ui/tokens";

export function panes(v: Tokens) {
  const demo = (options: PaneOptions, words: string) =>
    pane(v, { ...options, style: { flex: 1, minHeight: 132 } }, tag(v, words));
  return (
    <View style={{ flex: 1, padding: 32, gap: 28 }}>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {demo(
          { title: "At rest", color: v.role.heading2 },
          "A 1 px edge, which goes round the title.",
        )}
        {demo(
          { title: "Focused", focused: true },
          "The two lights at 45° and their glow, round the title too. The title fills with the light.",
        )}
        {demo(
          { title: "Needs you", more: "· 2", icon: "alert", needs: true },
          "An orange title, and no light: it is not where the keys go.",
        )}
        {demo(
          { title: "Running", icon: "bot", color: v.role.lightRunning, running: true },
          "A steady line on its top edge. It moves only when the run starts or ends.",
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 16 }}>
        {demo(
          { title: "Focused and running", focused: true, running: true },
          "The session in view: the focus's light, and the run's line.",
        )}
        {demo(
          { title: "Focused, needs you", icon: "alert", focused: true, needs: true },
          "The focus's light, and the title stays orange.",
        )}
        {pane(
          v,
          { title: "A pane in a pane", color: v.role.heading3, style: { flex: 1, minHeight: 132 } },
          pane(
            v,
            { title: "Card", fill: v.role.raised, style: { minHeight: 62 } },
            tag(v, "Raised. Two levels at most."),
          ),
        )}
        <View style={{ flex: 1, marginTop: v.pane.titleRise, gap: 12 }}>
          {field(v, { text: "A focused field takes the mode's colour", active: "normal" })}
          {field(v, { placeholder: "A field at rest: a well with a border" })}
          {field(v, { text: "Insert mode", active: "insert" })}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: v.space.gap.wide, height: 260 }}>
        {pane(
          v,
          { title: "Sessions", more: "· 3", icon: "chat", style: { width: 280 } },
          tag(v, "Panes sit on the backdrop with a gap of 8 px, as tiled windows do."),
        )}
        {pane(
          v,
          {
            title: "Session",
            more: "· nsh-migration · plan",
            icon: "chat",
            focused: true,
            running: true,
            style: { flex: 1 },
          },
          tag(v, "The focused pane is the only thing that emits light."),
        )}
        {pane(
          v,
          { title: "Plan", more: "· 61 tasks", color: v.role.heading1, style: { width: 320 } },
          tag(v, "At rest, nothing glows."),
        )}
      </View>
    </View>
  );
}
