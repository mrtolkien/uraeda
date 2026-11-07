// The phone's one sheet, for what rises from the bottom: a dialog's form, or a picker. Each has its
// title on top and a Close, over the frosted glass of what floats over the page. A swipe down on
// its top closes it, and a swipe up takes it to the whole screen.
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { glassStyles } from "./glass.ts";
import { safeAreaVars } from "./safeArea.stylex.ts";
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
  // A sheet shorter than the screen, over the phone's keyboard: lifted by what it covers, and no
  // taller than the room left above it, its content scrolling inside. Astryx follows the keyboard
  // for a tall sheet alone, and a field focused as the sheet opens does not scroll the page to it.
  // Astryx's sheet runs on under the screen's edge by its bleed, padded by it and by the safe area:
  // over the keyboard, both go under it, and the sheet's end, its last button, sits on it.
  lifted: {
    marginBlockEnd: `calc(var(--sheet-lift) - ${safeAreaVars["--sheet-bleed"]} - ${safeAreaVars["--safe-area-bottom"]})`,
    maxHeight: `calc(var(--sheet-most) + ${safeAreaVars["--sheet-bleed"]} + ${safeAreaVars["--safe-area-bottom"]})`,
  },
  // How far it lifts, and how tall it may be.
  liftedBy: (inset: number, most: number) => ({
    "--sheet-lift": `${inset}px`,
    "--sheet-most": `${most}px`,
  }),
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
 * How a sheet sits over a keyboard covering `keyboard` of a screen `screen` tall, under a bar
 * `top` tall, the phone's tabs: lifted by the whole keyboard, so its end, where its buttons are,
 * stays above it, and at most as tall as the room left, so its top, its title and Close, stays in
 * view. Nothing while no keyboard shows.
 */
export function keyboardFit(keyboard: number, screen: number, top = 0) {
  return keyboard > 0
    ? { lift: keyboard, most: Math.max(0, screen - keyboard - top - TOP_ROOM_PX) }
    : undefined;
}

/**
 * The lift of the sheet `panel`, when it `isShort`, over the phone's keyboard while it shows; and,
 * as the keyboard opens, its form scrolled to its end inside the sheet, so the field and the
 * buttons after it, as Add comment, show above the keyboard together.
 */
function useKeyboardLift(panel: RefObject<HTMLDivElement | null>, isShort: boolean) {
  const keyboard = useKeyboardInset();
  // The tabs stay over a sheet that leaves the page usable: it keeps its top below them.
  const top = document.querySelector('[role="banner"]')?.getBoundingClientRect().bottom ?? 0;
  const fit = isShort ? keyboardFit(keyboard, window.innerHeight, top) : undefined;
  const isLifted = fit !== undefined;
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    if (!isLifted || !focused || !panel.current?.contains(focused)) {
      return undefined;
    }
    // Once the sheet has its new height.
    const frame = requestAnimationFrame(() => {
      const form = focused.closest("form");
      const room = panel.current?.getBoundingClientRect().height ?? 0;
      const whole = form && form.getBoundingClientRect().height < room;
      (whole ? form : focused).scrollIntoView?.({ block: whole ? "end" : "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [isLifted, panel]);
  return isLifted && [styles.lifted, styles.liftedBy(fit.lift, fit.most)];
}

/** The sheet's top, its handle and its title row, where a swipe closes it or takes it up. */
const GRIP_PX = 64;
/** How far up a drag goes before the sheet takes the whole screen. */
const PULL_PX = 32;
/** How far down a swipe goes before the sheet closes as the finger lets go. */
const SWIPE_PX = 48;

/** Whether `target`, or a box around it inside `panel`, is scrolled down from its top. */
function isScrolledDown(target: EventTarget | null, panel: HTMLElement) {
  for (let box = target as HTMLElement | null; box && box !== panel; box = box.parentElement) {
    if (box.scrollTop > 0) {
      return true;
    }
  }
  return false;
}

/** How long after a close another close is the same one, from Astryx's gesture or the sheet's. */
const SAME_CLOSE_MS = 600;

/**
 * `onClose`, called once for one gesture: a swipe down closes an `info` sheet from Astryx's own
 * gesture and from the sheet's, and a second close would go Back twice, leaving the page.
 */
function useOneClose(onClose: () => void) {
  const last = useRef(Number.NEGATIVE_INFINITY);
  return () => {
    const now = performance.now();
    if (now - last.current >= SAME_CLOSE_MS) {
      last.current = now;
      onClose();
    }
  };
}

/**
 * Follows a swipe on the top of the sheet `panel`: up takes it to the whole screen, `onFull`, as
 * soon as it passes `PULL_PX`, since Astryx's sheet opens at its tallest height, and has no stop
 * above it; down past `SWIPE_PX` closes it as the finger lets go, `onClose`, since Astryx's sheet
 * closes on a swipe only when its purpose is `info`, and from its handle's pointer events alone. A
 * swipe that starts on content scrolled down scrolls it back up, and does neither. A finger is
 * read from its touch events, which a browser keeps sending where it takes the pointer's for its
 * own gestures; a mouse or a pen from its pointer events.
 */
function useTopSwipe(
  panel: RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  onFull: () => void,
  onClose: () => void,
) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const element = panel.current;
    if (!isOpen || !element) {
      return;
    }
    let start: number | undefined;
    const down = (y: number, target: EventTarget | null) => {
      const top = element.getBoundingClientRect().top;
      start = y - top < GRIP_PX && !isScrolledDown(target, element) ? y : undefined;
    };
    const move = (y: number) => {
      if (start !== undefined && start - y > PULL_PX) {
        start = undefined;
        onFull();
      }
    };
    const up = (y: number | undefined) => {
      const swiped = start !== undefined && y !== undefined && y - start > SWIPE_PX;
      start = undefined;
      if (swiped) {
        close.current();
      }
    };
    const isMouse = (event: PointerEvent) => event.pointerType !== "touch";
    const pointerDown = (event: PointerEvent) => {
      if (isMouse(event)) {
        down(event.clientY, event.target);
      }
    };
    const pointerMove = (event: PointerEvent) => {
      if (isMouse(event)) {
        move(event.clientY);
      }
    };
    const pointerUp = (event: PointerEvent) => {
      if (isMouse(event)) {
        up(event.type === "pointerup" ? event.clientY : undefined);
      }
    };
    const touchStart = (event: TouchEvent) => {
      const touch = event.touches.length === 1 ? event.touches[0] : undefined;
      if (touch) {
        down(touch.clientY, event.target);
      } else {
        start = undefined;
      }
    };
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        move(touch.clientY);
      }
    };
    const touchEnd = (event: TouchEvent) => {
      up(event.type === "touchend" ? event.changedTouches[0]?.clientY : undefined);
    };
    const listening = new AbortController();
    const options = { capture: true, passive: true, signal: listening.signal };
    element.addEventListener("pointerdown", pointerDown, options);
    element.addEventListener("pointermove", pointerMove, options);
    element.addEventListener("pointerup", pointerUp, options);
    element.addEventListener("pointercancel", pointerUp, options);
    element.addEventListener("touchstart", touchStart, options);
    element.addEventListener("touchmove", touchMove, options);
    element.addEventListener("touchend", touchEnd, options);
    element.addEventListener("touchcancel", touchEnd, options);
    return () => listening.abort();
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
  /** `form` closes on Close, Back, Escape, or a swipe down; `info` also on a tap outside. */
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
  const closeOnce = useOneClose(onClose);
  useTopSwipe(panel, isOpen, onFull, closeOnce);
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
          closeOnce();
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
