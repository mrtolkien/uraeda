// A colour asked for by its hue: in a string, in a member key, and in a component's prop, written
// or picked by a condition. Each refused by `colour/roles-not-hues`: the Colour themes decision
// asks for a role.
import { Badge } from "@astryxdesign/core/Badge";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  edge: { borderColor: colorVars["--color-border-red"] },
  text: { color: "var(--color-text-orange)" },
});

export function HueToken({ active }: { active: boolean }) {
  return (
    <p {...stylex.props(styles.text, styles.edge)}>
      <Badge label="Waiting" variant="yellow" />
      <Badge label="Status" variant={active ? "green" : "neutral"} />
    </p>
  );
}
