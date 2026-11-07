// A badge in a role's colour, its text on the role's tint, as Astryx's hue variants draw theirs:
// those name a hue, which the Colour themes decision refuses in views, so Astryx's neutral badge
// takes the role through its `xstyle` (`theme/roles.ts`).
import { Badge } from "@astryxdesign/core/Badge";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  added: { backgroundColor: "var(--role-added-tint)", color: "var(--role-added)" },
  caution: { backgroundColor: "var(--role-caution-tint)", color: "var(--role-caution)" },
});

/** The roles a badge is drawn in. */
export type BadgeRole = keyof typeof styles;

/** A short label, such as a decision's status, in `role`'s colour. */
export function RoleBadge({ label, role }: { label: string; role: BadgeRole }) {
  return <Badge label={label} xstyle={styles[role]} />;
}
