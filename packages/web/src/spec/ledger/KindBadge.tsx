// A kind's pill, a decision's, a part's, or a data row's: new, changed, or removed.
import { Badge } from "@astryxdesign/core/Badge";

/** Each kind's pill, a card's, a part's, or a data row's. */
const KINDS: Record<string, { label: string; variant: "error" | "success" | "warning" }> = {
  added: { label: "New", variant: "success" },
  changed: { label: "Changed", variant: "warning" },
  new: { label: "New", variant: "success" },
  removed: { label: "Removed", variant: "error" },
};

/** A kind's pill. */
export function KindBadge({ kind }: { kind: string }) {
  const { label, variant } = KINDS[kind] ?? { label: kind, variant: "warning" };
  return <Badge label={label} variant={variant} />;
}
