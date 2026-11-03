// Continue all, in the border of home's Needs you pane: it sends each run that stopped and asks for
// the human its step's message (US5 of the worker lifecycle). While it is under the pointer or
// focused, home previews which runs it continues (`Core.tsx`).
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useState } from "react";
import { useFateClient } from "react-fate";
import { guarded, refusal } from "../errors.ts";
import { WorkspaceView } from "../views.ts";

export const previewStyles = stylex.create({
  // A row Continue all leaves alone, while its preview is on.
  dimmed: { opacity: 0.4 },
  // Rows fade in and out of the preview, never jump; at once with reduced motion.
  row: {
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "150ms" },
    transitionProperty: "opacity, background-color, box-shadow",
    transitionTimingFunction: "ease-out",
  },
});

/** "a, b, and c". */
const AND = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * The button: `onPreview` hears its preview start and end, on while it is under the pointer or
 * focused, either one. Its description names the runs it continues, `names`, for a screen reader,
 * which hears no preview. A refusal, as without the agent, is shown in a toast.
 */
export function ContinueAll({
  names,
  onPreview,
}: {
  names: Array<string>;
  onPreview: (isOn: boolean) => void;
}) {
  const fate = useFateClient();
  const described = useId();
  const showToast = useToast();
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const isOn = isHovered || isFocused;
  useEffect(() => onPreview(isOn), [isOn, onPreview]);
  const onPress = async () => {
    // A lost connection rejects the call: it is shown as a refusal.
    const result = await guarded(() =>
      fate.mutations.feature.continueAll({ input: {}, view: WorkspaceView }),
    );
    if (result.error) {
      showToast({ autoHideDuration: 5000, body: refusal(result.error).message });
    }
  };
  return (
    <span
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <Button
        aria-describedby={described}
        clickAction={onPress}
        label="Continue all"
        size="sm"
        variant="secondary"
      />
      <VisuallyHidden id={described}>Continues {AND.format(names)}</VisuallyHidden>
    </span>
  );
}
