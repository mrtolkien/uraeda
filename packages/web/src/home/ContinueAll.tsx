// Continue all, in the border of home's Needs you pane: it sends each run that stopped and asks for
// the human its step's message (US5 of the worker lifecycle). While it is under the pointer or
// focused, home previews which runs it continues (`Core.tsx`).
import { Button } from "@astryxdesign/core/Button";
import { useToast } from "@astryxdesign/core/Toast";
import * as stylex from "@stylexjs/stylex";
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

/**
 * The button: `onPreview` hears it come under the pointer or take the focus, and leave them. A
 * refusal, as without the agent, is shown in a toast.
 */
export function ContinueAll({ onPreview }: { onPreview: (isOn: boolean) => void }) {
  const fate = useFateClient();
  const showToast = useToast();
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
      onBlur={() => onPreview(false)}
      onFocus={() => onPreview(true)}
      onPointerEnter={() => onPreview(true)}
      onPointerLeave={() => onPreview(false)}
    >
      <Button clickAction={onPress} label="Continue all" size="sm" variant="secondary" />
    </span>
  );
}
