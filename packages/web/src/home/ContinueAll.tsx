// Continue all, in the border of home's Needs you pane: it sends each run that stopped and asks for
// the human its step's message (US5 of the worker lifecycle). While it is under the pointer or
// focused, home previews which runs it continues (`Core.tsx`); on a touch screen, which has no
// pointer over it, the first tap shows the preview and the second sends (R21).
import { Button } from "@astryxdesign/core/Button";
import { useTimedToast } from "../layout/useTimedToast.tsx";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import * as stylex from "@stylexjs/stylex";
import {
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFateClient, view } from "react-fate";
import type { ContinuedAll } from "uraeda-server/fate";
import { guarded, refusal } from "../errors.ts";

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

/** Continue all's answer: the runs it could not continue, each with why. */
const ContinuedAllView = view<ContinuedAll>()({
  id: true,
  refused: true,
});

/** How long, in ms, a tap's preview waits for the second tap. */
const TAP_PREVIEW = 4000;

/**
 * A tap's preview, inside `own`: the first tap shows it instead of sending, the second sends; a tap
 * elsewhere, or `TAP_PREVIEW` without one, ends it. A mouse or a key sends at once.
 */
function useTapPreview(own: RefObject<HTMLElement | null>) {
  const [isOn, setOn] = useState(false);
  // Whether the press under way began with a touch.
  const touch = useRef(false);
  useEffect(() => {
    if (!isOn) {
      return;
    }
    const end = () => setOn(false);
    const timer = setTimeout(end, TAP_PREVIEW);
    const away = (event: Event) => {
      if (!own.current?.contains(event.target as Node)) {
        end();
      }
    };
    document.addEventListener("pointerdown", away, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", away, true);
    };
  }, [isOn, own]);
  return {
    isOn,
    onClickCapture: (event: MouseEvent) => {
      // A key's press after a tap is no tap.
      const isTap = touch.current;
      touch.current = false;
      if (isTap && !isOn) {
        // The button's own press reads it, and does not send.
        event.preventDefault();
      }
      setOn(isTap && !isOn);
    },
    onPointerDownCapture: (event: PointerEvent) => {
      touch.current = event.pointerType === "touch";
    },
  };
}

/** "a, b, and c". */
const AND = new Intl.ListFormat("en", { type: "conjunction" });

/**
 * What the toast says of the runs Continue all could not continue, by refusal: "cli-tuis and search
 * could not continue: another session of this feature is working."
 */
function refusedText(refused: ReadonlyArray<{ name: string; reason: string }>): string {
  const byReason = Map.groupBy(refused, ({ reason }) => reason);
  return [...byReason]
    .map(([reason, runs]) => {
      const why = `${reason.charAt(0).toLowerCase()}${reason.slice(1)}`;
      return `${AND.format(runs.map(({ name }) => name))} could not continue: ${why.replace(/\.?$/, ".")}`;
    })
    .join(" ");
}

/**
 * The button: `onPreview` hears its preview start and end, on while it is under the pointer or
 * focused, either one, or after a first tap. Its description names the runs it continues, `names`, for a screen reader,
 * which hears no preview. A refusal, as without the agent, is shown in a toast, and so are the runs
 * it could not continue, each with why.
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
  const showToast = useTimedToast();
  const own = useRef<HTMLSpanElement>(null);
  const tap = useTapPreview(own);
  const [isHovered, setHovered] = useState(false);
  const [isFocused, setFocused] = useState(false);
  const isOn = isHovered || isFocused || tap.isOn;
  useEffect(() => onPreview(isOn), [isOn, onPreview]);
  const onPress = async () => {
    // A lost connection rejects the call: it is shown as a refusal.
    const result = await guarded(() =>
      fate.mutations.feature.continueAll({ input: {}, view: ContinuedAllView }),
    );
    if (result.error) {
      showToast({ autoHideDuration: 5000, body: refusal(result.error).message });
      return;
    }
    // The others went on: the runs refused stay as they were, and the toast says why.
    const refused = result.result?.refused ?? [];
    if (refused.length > 0) {
      showToast({ autoHideDuration: 8000, body: refusedText(refused) });
    }
  };
  return (
    <span
      onBlur={() => setFocused(false)}
      onClickCapture={tap.onClickCapture}
      // A tap focuses the button too, but shows the preview only until it ends: a key's focus does.
      onFocus={(event) => setFocused(event.target.matches(":focus-visible"))}
      // A finger is over the button only while it touches it: its tap's preview stands for it.
      onPointerDownCapture={tap.onPointerDownCapture}
      onPointerEnter={(event) => setHovered(event.pointerType !== "touch")}
      onPointerLeave={() => setHovered(false)}
      ref={own}
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
