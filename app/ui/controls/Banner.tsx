// A banner: a status that stays next to what it concerns until it is dealt with, never only in a
// toast. Its icon and title in its tone, its words under them, and the way out beside them: a
// button. A bar of its tone on its left edge, on a faint block of it.
import { computed, type JSX, View } from "nsh";
import { type IconName, Icon } from "./Icon";
import { Text } from "./Text";
import { type Tone, tokens } from "../tokens";

export type BannerProps = {
  /** The way out: a button that deals with it. */
  action?: JSX.Element;
  /** What it says beyond its title: the cause, and what to do. */
  children?: JSX.Element;
  icon?: IconName;
  testID?: string;
  title: string;
  tone?: Extract<Tone, "info" | "caution" | "danger" | "done" | "needs">;
};

const ICONS: Record<NonNullable<BannerProps["tone"]>, IconName> = {
  caution: "triangle-alert",
  danger: "circle-alert",
  done: "circle-check",
  info: "info",
  needs: "circle-dot",
};

export function Banner(props: BannerProps) {
  const tone = () => props.tone ?? "info";
  const colour = () => tokens.control.tone(tone());
  // Each read of a prop holding elements makes them again: read once, a button's key is declared
  // once, as it is drawn once.
  const action = computed(() => props.action);
  const words = computed(() => props.children);
  return (
    <View
      style={{
        backgroundColor: tokens.control.wash(colour()),
        borderColor: colour(),
        borderLeftWidth: 2,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
      testID={props.testID}
    >
      <View style={{ flexBasis: 240, flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 8 }}>
        <Icon colour={colour()} name={props.icon ?? ICONS[tone()]} style={{ marginTop: 4 }} />
        <View style={{ flexShrink: 1 }}>
          <Text bold colour={colour()}>
            {props.title}
          </Text>
          <If when={words() !== undefined}>
            <Text tone="ink">{words()}</Text>
          </If>
        </View>
      </View>
      <If when={action() !== undefined}>
        {/* Never wider than the banner: a long label is cut at its end, not past the edge. */}
        <View style={{ alignSelf: "center", maxWidth: "100%" }}>{action()}</View>
      </If>
    </View>
  );
}
