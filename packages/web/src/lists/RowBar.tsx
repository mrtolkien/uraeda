// What a row can do, under its text, each with its key as the status line writes it: "⏎ edit",
// "m move", "d delete". It shows under the row the keys or a click picked, and under a row's field
// while it is edited, so a mouse and a finger reach what the keys do. A press keeps the focus where
// it is, in the row or in its field. On the phone, where keys are no help, the bar floats at the
// screen's bottom instead, over the keyboard when it shows, a big icon for each action over its
// word, on frosted glass.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type ComponentProps,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { KeyCap } from "../keys/KeyCap.tsx";
import { keepFocus } from "../keys/press.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { useCoverStatusLine } from "../statusHints.tsx";

/**
 * One thing a row can do: its key as written, what it does, doing it, and its icon on the phone.
 * One with no icon is for the keyboard alone, and the phone leaves it out.
 */
export type BarAction = {
  icon?: ComponentProps<typeof Icon>["icon"];
  keys: string;
  label: string;
  run: () => void;
};

const appear = stylex.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const rise = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(calc(100% + 1rem))" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const sink = stylex.keyframes({
  from: { opacity: 1, transform: "translateY(0)" },
  to: { opacity: 0, transform: "translateY(calc(100% + 1rem))" },
});

/** How far the page scrolls, in pixels, before the phone's bar goes: a finger's tremor is no scroll. */
const SCROLLED_PX = 8;

const styles = stylex.create({
  // A line of its own under the text, over the row's stretched link so a press reaches it.
  bar: {
    animationDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    animationName: appear,
    animationTimingFunction: "ease-out",
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
    paddingBlock: "0.125rem",
    position: "relative",
    zIndex: 2,
  },
  press: {
    background: "none",
    border: "none",
    color: { ":hover": colorVars["--color-text-primary"], default: "inherit" },
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
  // The phone's bar: liquid glass, square, floating over the page above the screen's bottom, as
  // wide as its actions. Tinted a warm amber of its own, not the theme's, over what is behind it,
  // blurred: its shapes and colours show through, never its words; blurred more, the dim text of
  // a dark page blends to one flat colour, as if opaque. A bright rim catches the light on its top
  // edge, and a soft shadow lifts it. One blur every browser draws: Firefox draws no backdrop at
  // all for one that names an SVG filter.
  floating: {
    animationDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "240ms" },
    animationFillMode: "both",
    animationName: rise,
    animationTimingFunction: "cubic-bezier(0.25, 1, 0.5, 1)",
    backdropFilter: "blur(7px) saturate(1.8)",
    backgroundColor: "rgb(255 178 102 / 0.1)",
    borderRadius: 0,
    boxShadow: [
      "inset 0 0 0 1px rgb(255 226 190 / 0.4)",
      "inset 0 1px 1px rgb(255 248 236 / 0.75)",
      "inset 0 -1px 2px rgb(255 190 130 / 0.18)",
      "0 10px 30px rgb(0 0 0 / 0.28)",
    ].join(", "),
    display: "flex",
    insetBlockEnd: `calc(env(safe-area-inset-bottom, 0px) + ${spacingVars["--spacing-4"]})`,
    insetInline: 0,
    marginInline: "auto",
    maxWidth: `calc(100% - 2 * ${spacingVars["--spacing-4"]})`,
    padding: spacingVars["--spacing-1"],
    position: "fixed",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own spelling, which Safari still needs
    WebkitBackdropFilter: "blur(7px) saturate(1.8)",
    width: "fit-content",
    zIndex: 3,
  },
  // Over the phone's keyboard, which covers the screen's bottom.
  overKeyboard: (px: number) => ({ insetBlockEnd: `calc(${px}px + 0.5rem)` }),
  // Going, as the page scrolls: it sinks out of the screen.
  sinking: { animationName: sink, pointerEvents: "none" },
  // An action of the phone's bar: its icon over its word, as wide as a finger at least, in the
  // theme's text colour, which reads over the clear glass.
  tile: {
    alignItems: "center",
    background: "none",
    border: "none",
    borderRadius: 0,
    color: colorVars["--color-text-primary"],
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    font: "inherit",
    gap: "0.25rem",
    minWidth: "4rem",
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  word: { fontSize: "0.75rem" },
});

/** Runs an action from a press, which is not the row's own click: that edits it or opens it. */
const pressed = (action: BarAction) => (event: { stopPropagation: () => void }) => {
  event.stopPropagation();
  action.run();
};

/**
 * How long the bar's own scroll, bringing its row clear of it, may glide where the browser does not
 * say when a scroll ends, in ms.
 */
const REVEAL_MS = 1000;

/** The room left between a row and the bar over the screen's bottom, in pixels. */
const CLEAR_PX = 8;

/**
 * Whether the page scrolled up or down since the bar showed, by more than `SCROLLED_PX`, in
 * whatever scrolls: the window or a part of the page. Sideways is no scroll, as the columns glide
 * to the selection's, and neither is the bar's own until `quiet.current`, a time as
 * `performance.now()` reads it: the page rests where that scroll leaves it.
 */
function useScrolledAway(quiet: RefObject<number>) {
  const [isAway, setAway] = useState(false);
  useEffect(() => {
    const starts = new WeakMap<object, number>();
    const page = document.scrollingElement;
    if (page) {
      starts.set(page, page.scrollTop);
    }
    const onScroll = (event: Event) => {
      const target = event.target instanceof Element ? event.target : document.scrollingElement;
      if (!target) {
        return;
      }
      const start = starts.get(target);
      if (start === undefined || performance.now() < quiet.current) {
        // The first scroll of a part counts from where it was before it: the bar showed there.
        starts.set(target, target.scrollTop);
        return;
      }
      if (Math.abs(target.scrollTop - start) > SCROLLED_PX) {
        setAway(true);
      }
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, [quiet]);
  return isAway;
}

/** The nearest part of the page holding `element` that scrolls up and down, else the page's. */
function scrollerOf(element: Element) {
  for (let at = element.parentElement; at && at !== document.body; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at);
    if ((overflowY === "auto" || overflowY === "scroll") && at.scrollHeight > at.clientHeight) {
      return at;
    }
  }
  return document.scrollingElement ?? document.documentElement;
}

/**
 * Scrolls the row holding `anchor`, or its field, up clear of `bar` when the bar covers it, gliding
 * unless the human asked for less motion; the bar ignores that scroll until it ends (see
 * `useScrolledAway`). Where the bar rests is read past its rising, which moves it. Called again
 * before the glide ends, it heads to the same place.
 */
function reveal(anchor: Element, bar: HTMLElement, quiet: { current: number }) {
  const row = anchor.closest("[data-row-frame]") ?? anchor.parentElement;
  if (!row) {
    return;
  }
  const covered = row.getBoundingClientRect().bottom - (bar.offsetTop - CLEAR_PX);
  if (covered <= 0) {
    return;
  }
  const scroller = scrollerOf(row);
  // As far as the page goes: a scroll that cannot happen never ends.
  const top = Math.min(scroller.scrollTop + covered, scroller.scrollHeight - scroller.clientHeight);
  if (top - scroller.scrollTop < 1) {
    return;
  }
  const isInstant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Quiet until the scroll ends, or for `REVEAL_MS` where no browser event says so.
  if ("onscrollend" in window) {
    quiet.current = Number.POSITIVE_INFINITY;
    const ends = scroller === document.scrollingElement ? document : scroller;
    ends.addEventListener("scrollend", () => (quiet.current = 0), { once: true });
  } else {
    quiet.current = performance.now() + REVEAL_MS;
  }
  scroller.scrollTo({ behavior: isInstant ? "instant" : "smooth", top });
}

/**
 * How much of the screen's bottom the phone's keyboard covers, in pixels: what the visual viewport
 * leaves out under it. None where the browser does not say.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return undefined;
    }
    const measure = () =>
      setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);
  return inset;
}

/**
 * The phone's bar, at the screen's bottom, over the keyboard when it shows, and over the status
 * line it covers while it shows. A row's (`onAway`) goes as the page scrolls, so the rows under it
 * can be read, and calls `onAway` once it sank: a tap on a row brings it back. A field's stays, as
 * the keyboard's opening scrolls the page. Its row, where `anchor` is, scrolls clear of it as it
 * shows and as the keyboard opens.
 */
function FloatingBar({
  actions,
  anchor,
  isField,
  onAway,
}: {
  actions: ReadonlyArray<BarAction>;
  anchor: RefObject<HTMLSpanElement | null>;
  isField: boolean;
  onAway?: () => void;
}) {
  const quiet = useRef(0);
  const bar = useRef<HTMLDivElement>(null);
  const isAway = useScrolledAway(quiet) && !isField;
  const keyboard = useKeyboardInset();
  useCoverStatusLine(!isAway);
  useLayoutEffect(() => {
    if (anchor.current && bar.current) {
      reveal(anchor.current, bar.current, quiet);
    }
  }, [anchor, keyboard]);
  return createPortal(
    <div
      aria-label={isField ? "Field actions" : "Row actions"}
      onAnimationEnd={() => {
        if (isAway) {
          onAway?.();
        }
      }}
      onMouseDown={keepFocus}
      ref={bar}
      role="toolbar"
      {...stylex.props(
        styles.floating,
        keyboard > 0 && styles.overKeyboard(keyboard),
        isAway && styles.sinking,
      )}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={pressed(action)}
          type="button"
          {...stylex.props(styles.tile)}
        >
          <Icon icon={action.icon} size="lg" />
          <span {...stylex.props(styles.word)}>{action.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  );
}

/**
 * The row's actions, in the order given, under the row or its field. On the phone they float at the
 * screen's bottom instead (see `FloatingBar`): `isField` says they are a field's, which stay while
 * the page scrolls; a row's go, then call `onAway`.
 */
export function RowBar({
  actions,
  isField = false,
  onAway,
}: {
  actions: ReadonlyArray<BarAction>;
  isField?: boolean;
  onAway?: () => void;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  if (isNarrow(useWidthClass())) {
    const tiles = actions.filter((action) => action.icon !== undefined);
    return tiles.length > 0 ? (
      <>
        {/* Where the bar's row is, which it scrolls clear of. */}
        <span hidden ref={anchor} />
        <FloatingBar actions={tiles} anchor={anchor} isField={isField} onAway={onAway} />
      </>
    ) : null;
  }
  return (
    // A press between its buttons keeps the focus too.
    <div onMouseDown={keepFocus} {...stylex.props(styles.bar)}>
      {actions.map((action) => (
        <Text color="secondary" key={action.label} type="supporting">
          <button onClick={pressed(action)} type="button" {...stylex.props(styles.press)}>
            <KeyCap>{action.keys}</KeyCap> {action.label}
          </button>
        </Text>
      ))}
    </div>
  );
}
