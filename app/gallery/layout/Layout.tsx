// The layout shell's gallery pages, on the real renderer: the whole frame with sample panes in both
// stacks, at the window's width, in the theme its host names. A page starts its visit with a
// layout of its own: the default, the focus on the side stack's tabs, the side stack split, and
// the side stack and the rail folded. `just gallery-shots` takes their pictures.
import { colorScheme, host, mount, View } from "nsh";
import { keep } from "../../store/history";
import { Icon, Text } from "../../ui/controls";
import { KeysHost } from "../../ui/keys/KeysHost";
import {
  definePane,
  fold,
  focus,
  type Layout,
  layoutOf,
  PaneScroll,
  type Place,
  type RailPlace,
  split,
  Stacks,
  toTabs,
} from "../../ui/layout";
import { Pane } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, tokens, tokensOf } from "../../ui/tokens";

/** A row of a sample pane: an icon in a hue, its words, and what follows them, dimmer. */
function Row(props: {
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

const transcript = definePane<{ session: string }>({
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

const notes = definePane({
  closes: true,
  icon: "file-text",
  kind: "gallery-notes",
  stack: "main",
  title: "Notes",
  view: () => <Text>Notes on the session.</Text>,
});

const activity = definePane({
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

const changes = definePane({
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

const agents = definePane({
  icon: "bot",
  kind: "gallery-agents",
  mark: () => ({ needs: true }),
  stack: "side",
  title: "Agents",
  view: () => <Row hue={tokens.light.needs} icon="bot" meta="asks" text="Reviewer: which width?" />,
});

const PLACE: Place = {
  main: [transcript({ session: "s1" }), notes({})],
  side: [activity({}), changes({}), agents({})],
};

/** Each page's layout, from the place's default. */
const PAGES: Record<string, (start: Layout) => Layout> = {
  folded: (start) => fold(start, true),
  frame: (start) => start,
  split: (start) => split(focus(start, PLACE.side[1].key), "side", true),
  tabs: (start) => toTabs(focus(start, PLACE.side[0].key), true),
};

const nothing = () => {};

const PLACES = [
  { icon: "house", label: "Home", onPress: nothing },
  { count: 10, icon: "inbox", label: "Inbox", needs: true, onPress: nothing },
  { icon: "flag", label: "Priorities", onPress: nothing },
  { current: true, icon: "message-square", label: "Sessions", onPress: nothing },
  { icon: "scale", label: "Decisions", onPress: nothing },
  { icon: "git-branch", label: "Git", onPress: nothing },
  { icon: "settings", label: "Settings", onPress: nothing },
] satisfies ReadonlyArray<RailPlace>;

function Gallery() {
  showTokens(tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]));
  const page = String(host.params.page ?? "frame");
  keep({ layout: (PAGES[page] ?? PAGES.frame)(layoutOf(PLACE)) });
  return (
    <KeysHost>
      <Stacks
        place={PLACE}
        rail={{
          places: PLACES,
          sidebar: (
            <Pane body={{ gap: 0 }} more="· 3" style={{ flex: 1 }} title="Features">
              <Row hue={tokens.light.running} icon="circle-dot" meta="plan" text="nsh-migration" />
              <Row hue={tokens.light.needs} icon="circle-dot" meta="q2" text="multi-accounts" />
              <Row icon="circle-dot" meta="spec" text="remote-agents" />
            </Pane>
          ),
          title: "uraeda",
        }}
        status={{
          end: <Text tone="quiet">live</Text>,
          place: "33:66",
          start: <Text tone="quiet">2026-11-10-nsh-migration</Text>,
        }}
      />
    </KeysHost>
  );
}

mount(Gallery);
