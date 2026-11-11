// The sample panes of the layout shell's place: a transcript and notes in the main stack, a
// session's activity, its changes, and its agents in the side one, each with its tab's mark. The
// gallery shows them as one place, in the frame every screen is drawn in.
import { View } from "nsh";
import { Icon, Text } from "../../ui/controls";
import { definePane, PaneScroll } from "../../ui/layout";
import { tokens } from "../../ui/tokens";

/** A row of a sample pane: an icon in a hue, its words, and what follows them, dimmer. */
export function Row(props: {
  hue?: string;
  icon: "check" | "circle-dot" | "file-text" | "bot";
  meta?: string;
  text: string;
}) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 8, height: tokens.space.row }}>
      <Icon colour={props.hue ?? tokens.role.inkQuiet} name={props.icon} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text lines={1}>{props.text}</Text>
      </View>
      <If when={props.meta}>{(meta) => <Text tone="faint">{meta()}</Text>}</If>
    </View>
  );
}

const LINES = [
  "Read the plan's section on the layout shell.",
  "A pane is a kind and its arguments, as a route is.",
  "Two stacks: main at the centre, side at the right.",
  "The side stack folds to a rail of its panes' icons.",
  "On a phone both stacks are one, with a bar of tiles.",
  "The frame's keys are fallbacks: a pane's own come first.",
];

export const transcript = definePane<{ session: string }>({
  flush: true,
  icon: "message-square",
  kind: "gallery-transcript",
  mark: () => ({ running: true }),
  stack: "main",
  title: "Transcript",
  view: () => (
    <PaneScroll contentStyle={{ gap: 10, padding: 11 }} style={{ flex: 1 }}>
      <Each of={[...LINES, ...LINES, ...LINES]}>
        {(line, index) => (
          <Text tone={index() % 3 === 0 ? "ink" : "quiet"}>
            {index() % 3 === 0 ? "› " : ""}
            {line()}
          </Text>
        )}
      </Each>
    </PaneScroll>
  ),
});

export const notes = definePane({
  closes: true,
  icon: "file-text",
  kind: "gallery-notes",
  stack: "main",
  title: "Notes",
  view: () => <Text>Notes on the session.</Text>,
});

export const activity = definePane({
  icon: "activity",
  kind: "gallery-activity",
  mark: () => ({ count: 12 }),
  stack: "side",
  title: "Activity",
  view: () => (
    <View>
      <Row hue={tokens.role.added} icon="check" meta="12:04" text="Read plan.md" />
      <Row hue={tokens.role.added} icon="check" meta="12:05" text="Wrote layout.ts" />
      <Row hue={tokens.light.running} icon="circle-dot" meta="12:07" text="Running the tests" />
    </View>
  ),
});

export const changes = definePane({
  icon: "git-compare",
  kind: "gallery-changes",
  mark: () => ({ count: 4 }),
  stack: "side",
  title: "Changes",
  view: () => (
    <View>
      <Row hue={tokens.role.added} icon="file-text" meta="+212" text="app/ui/layout/layout.ts" />
      <Row hue={tokens.role.added} icon="file-text" meta="+148" text="app/ui/layout/Stacks.tsx" />
      <Row hue={tokens.role.context} icon="file-text" meta="+31" text="app/ui/surfaces/Pane.tsx" />
      <Row hue={tokens.role.removed} icon="file-text" meta="-4" text="app/ui/width.ts" />
    </View>
  ),
});

export const agents = definePane({
  icon: "bot",
  kind: "gallery-agents",
  mark: () => ({ needs: true }),
  stack: "side",
  title: "Agents",
  view: () => <Row hue={tokens.light.needs} icon="bot" meta="asks" text="Reviewer: which width?" />,
});
