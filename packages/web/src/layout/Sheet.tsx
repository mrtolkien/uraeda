// The phone's one sheet, for what rises from the bottom: a dialog's form, or a picker. Each has its
// title on top and a Close, over the frosted glass of what floats over the page, and a drag up on
// its top takes it to the whole screen.
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { glassStyles } from "./glass.ts";
import { useFieldFocus } from "./useFieldFocus.ts";
import { useKeyboardInset } from "./useKeyboardInset.ts";

const styles = stylex.create({
  // Astryx paints its surface on the sheet, its scrolling body, and its handle's band: taken away
  // inside the sheet, the glass under them shows.
  sheet: {
    [colorVars["--color-background-surface"]]: "transparent",
    // Taken to the whole screen, it grows there, from its own height, even one that hugs its
    // content: Astryx's sheet moves with its transform and opacity alone.
    interpolateSize: "allow-keywords",
    transitionProperty: "transform, opacity, height, max-height, margin-block-end",
  },
  // A sheet shorter than the screen, over the phone's keyboard: lifted by what it covers. Astryx
  // follows the keyboard for a tall sheet alone, and a field focused as the sheet opens does not
  // scroll the page to it.
  lifted: (inset: number) => ({ marginBlockEnd: inset }),
  // The sheet's heading over its content, which takes the rest of the sheet's height: a part of it
  // that scrolls on its own stays in the sheet, under the parts after it.
  fill: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  // A content that draws its own title, and scrolls it away: the Close alone stays, at the
  // sheet's top right, over what scrolls under it.
  float: {
    insetBlockStart: 0,
    insetInlineEnd: 0,
    position: "absolute",
    zIndex: 2,
  },
  // The content the Close floats over.
  under: { position: "relative" },
  // A sheet whose content brings its own inset, a picker's: its title row takes the sheet's.
  inset: {
    paddingBlockStart: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
});

/** The room a lifted sheet keeps above its top, under the phone's top edge. */
const TOP_ROOM_PX = 16;

/**
 * How far a sheet `height` tall lifts over a keyboard covering `keyboard` of a screen `screen`
 * tall: by the keyboard, but never so far that its top, its title and Close, leaves the screen.
 */
export function liftOf(keyboard: number, height: number, screen: number) {
  return Math.max(0, Math.min(keyboard, screen - height - TOP_ROOM_PX));
}

/** The lift of the sheet `panel`, when it `isShort`, over the phone's keyboard while it shows. */
function useKeyboardLift(panel: RefObject<HTMLDivElement | null>, isShort: boolean) {
  const keyboard = useKeyboardInset();
  const height = panel.current?.getBoundingClientRect().height ?? 0;
  const lift = isShort && keyboard > 0 ? liftOf(keyboard, height, window.innerHeight) : 0;
  return lift > 0 && styles.lifted(lift);
}

/** The sheet's top, its handle and its title row, where a drag up takes it to the whole screen. */
const GRIP_PX = 64;
/** How far up a drag goes before the sheet takes the whole screen. */
const PULL_PX = 32;

/**
 * Takes the sheet `panel` to the whole screen, `onFull`, on a drag up from its top: Astryx's sheet
 * opens at its tallest height, and has no stop above it.
 */
function usePullUp(panel: RefObject<HTMLDivElement | null>, isOpen: boolean, onFull: () => void) {
  useEffect(() => {
    const element = panel.current;
    if (!isOpen || !element) {
      return;
    }
    let start: number | undefined;
    const down = (event: PointerEvent) => {
      const top = element.getBoundingClientRect().top;
      start = event.clientY - top < GRIP_PX ? event.clientY : undefined;
    };
    const move = (event: PointerEvent) => {
      if (start !== undefined && start - event.clientY > PULL_PX) {
        start = undefined;
        onFull();
      }
    };
    const up = () => {
      start = undefined;
    };
    element.addEventListener("pointerdown", down, { capture: true });
    element.addEventListener("pointermove", move, { capture: true });
    element.addEventListener("pointerup", up, { capture: true });
    element.addEventListener("pointercancel", up, { capture: true });
    return () => {
      element.removeEventListener("pointerdown", down, { capture: true });
      element.removeEventListener("pointermove", move, { capture: true });
      element.removeEventListener("pointerup", up, { capture: true });
      element.removeEventListener("pointercancel", up, { capture: true });
    };
  }, [isOpen, onFull, panel]);
}

/**
 * A bottom sheet titled `label`, with a Close that calls `onClose`, in frosted glass. `isPadded`
 * false leaves its content at the sheet's edges, a picker's list, its title row still inset.
 */
export function Sheet({
  children,
  fills = false,
  hasScrim = true,
  height = "tall",
  isOpen,
  isPadded = true,
  isTitleInContent = false,
  label,
  onClose,
  purpose = "info",
  ref,
}: {
  children: ReactNode;
  /** Whether the content fills the sheet's height, as a flex column's item. */
  fills?: boolean;
  /** Whether the page behind the sheet is blocked, and dimmed. */
  hasScrim?: boolean;
  /** Astryx's `tall` (92%), `capped` (62%), or `hug`, as tall as its content, up to 92%. */
  height?: "tall" | "capped" | "hug";
  isOpen: boolean;
  isPadded?: boolean;
  /**
   * Whether the content draws the title itself, at its top, scrolling it away with the rest: the
   * Close alone stays, floating at the sheet's top right. With `fills`.
   */
  isTitleInContent?: boolean;
  label: string;
  onClose: () => void;
  /** `form` closes only on Close, Back, or Escape; `info` also on a tap outside, or a swipe. */
  purpose?: "form" | "info";
  ref?: RefObject<HTMLDivElement | null>;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const [full, setFull] = useState(false);
  // A sheet opened again opens at its own height.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setFull(false);
  }
  const [onFull] = useState(() => () => setFull(true));
  usePullUp(panel, isOpen, onFull);
  useFieldFocus(panel, isOpen);
  const lift = useKeyboardLift(panel, height !== "tall" && !full);
  const close = (
    <Button
      icon={<Icon icon="close" />}
      isIconOnly
      label="Close"
      onClick={onClose}
      variant="ghost"
      {...(isTitleInContent ? { xstyle: styles.float } : {})}
    />
  );
  const content = isTitleInContent ? (
    <>
      {close}
      {isOpen && children}
    </>
  ) : (
    <>
      <HStack align="center" gap={2} justify="between" xstyle={isPadded ? undefined : styles.inset}>
        <Heading level={2}>{label}</Heading>
        {close}
      </HStack>
      {isOpen && children}
    </>
  );
  return (
    <BottomSheet
      hasScrim={hasScrim}
      height={full ? "100dvh" : height}
      isOpen={isOpen}
      label={label}
      onOpenChange={(open: boolean) => {
        if (!open) {
          onClose();
        }
      }}
      padding={isPadded ? 4 : 0}
      purpose={purpose}
      ref={(element: HTMLDivElement | null) => {
        panel.current = element;
        if (ref) {
          ref.current = element;
        }
      }}
      xstyle={[glassStyles.surface, glassStyles.docked, styles.sheet, lift]}
    >
      {fills ? (
        <div {...stylex.props(styles.fill, isTitleInContent && styles.under)}>{content}</div>
      ) : (
        content
      )}
    </BottomSheet>
  );
}
