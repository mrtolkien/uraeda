// A colour asked for by its hue: in a string, in a member key, in a component's prop, written or
// picked by a condition, in an object's `variant` passed on as props, as a hue's name alone, and as
// a hue token built from a template. Each refused by `colour/roles-not-hues`: the Colour themes
// decision asks for a role.
import { Badge } from "@astryxdesign/core/Badge";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  edge: { borderColor: colorVars["--color-border-red"] },
  text: { color: "var(--color-text-orange)" },
  built: (hue: string) => ({ color: `var(--color-text-${hue})` }),
});

/** A badge's props, handed on whole. */
const waiting = { label: "Waiting", variant: "red" } as const;
/** A hue named alone, to build a token from. */
const tone = "purple";

export function HueToken({ active }: { active: boolean }) {
  return (
    <p {...stylex.props(styles.text, styles.edge)}>
      <Badge label="Waiting" variant="yellow" />
      <Badge label="Status" variant={active ? "green" : "neutral"} />
      <Badge {...waiting} />
      <span {...stylex.props(styles.built(tone))}>Built</span>
    </p>
  );
}
