// The leader menu: the keys pressed so far as its title, then what each next key does, each with its
// icon, a group marked by an arrow, in alphabetical order of their keys, on the phone's frosted glass
// (`glassStyles`), square, as the phone's floating bars are. It sits at the window's bottom right,
// above the status line, and on narrow screens spans the window's width, as the UI layout
// decision's sheets do. `LeaderMenuHost` feeds it the registry's step.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import {
  colorVars,
  easeVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { menuVars } from "./menu.stylex.ts";
import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";
import { bareButtonStyles } from "../layout/bareButton.ts";
import { glassStyles } from "../layout/glass.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { brighten } from "../sidebar/brighten.ts";
import { BackGlyph } from "./Glyphs.tsx";
import { KeyCap } from "./KeyCap.tsx";
import { keepFocus, pressKeys } from "./press.ts";

/** What a key does at this step: a group opens the next step, anything else runs. */
export type MenuEntry = {
  icon: ComponentProps<typeof Icon>["icon"];
  isGroup?: boolean;
  key: string;
  label: string;
};

/** How long the menu takes to slide in and out, which the host waits out before it unmounts it. */
export const SLIDE_MS = 200;

const rise = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(1.5rem)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const sink = stylex.keyframes({
  from: { opacity: 1, transform: "translateY(0)" },
  to: { opacity: 0, transform: "translateY(1.5rem)" },
});

const styles = stylex.create({
  // The menu's content on the glass: its title, its entries, and its footer, in a pane's room.
  box: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-2"],
    padding: spacingVars["--spacing-3"],
  },
  closing: {
    animationName: sink,
    // Gone from the keys' reach as it leaves: it stays drawn only until it has slid away.
    pointerEvents: "none",
  },
  entries: {
    columnGap: spacingVars["--spacing-6"],
    display: "grid",
    gridAutoFlow: "column",
    gridTemplateRows: "repeat(12, auto)",
    listStyle: "none",
    margin: 0,
    padding: 0,
    rowGap: spacingVars["--spacing-1"],
  },
  entry: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-2"],
  },
  // The content's frame, which eases to the size the menu's step needs. The content stays at the
  // frame's top left and is clipped to it, inside the glass, whose shadow it leaves whole.
  frame: {
    boxSizing: "border-box",
    overflow: "hidden",
    transitionDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s",
      default: `${SLIDE_MS}ms`,
    },
    transitionProperty: "height, width",
    transitionTimingFunction: easeVars["--ease-standard"],
  },
  // A row's button, as wide as its row.
  full: {
    display: "block",
    width: "100%",
  },
  oneColumn: {
    gridAutoFlow: "row",
    gridTemplateRows: "none",
  },
  place: {
    animationDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s",
      default: `${SLIDE_MS}ms`,
    },
    animationFillMode: "forwards",
    animationName: rise,
    animationTimingFunction: easeVars["--ease-standard"],
    insetBlockEnd: `calc(var(--size-status-line, 0px) + ${spacingVars["--spacing-2"]})`,
    insetInlineEnd: spacingVars["--spacing-3"],
    minWidth: "var(--size-leader-menu, 20rem)",
    position: "fixed",
    zIndex: 3,
  },
  // Square, as every glass is.
  square: { borderRadius: 0 },
  // A row or a footer key that presses its key when clicked, as a link in the text.
  press: { textAlign: "start" },
  sheet: {
    insetInline: spacingVars["--spacing-2"],
    minWidth: 0,
  },
  // The frame at the menu's natural size, in pixels, as measured.
  sized: (width: number, height: number) => ({ height, width }),
  // The keys pressed so far, in the accent, as an active pane's title.
  title: {
    color: colorVars["--color-text-accent"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
  // The menu's words, a step over the supporting text, at the body's 16 px and its weight.
  text: {
    fontSize: menuVars["--menu-text"],
    fontWeight: fontWeightVars["--font-weight-normal"],
    lineHeight: typeScaleVars["--text-label-leading"],
  },
  // A copy of the menu at its natural size, unseen, which `size` is measured on.
  twin: {
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    minWidth: "var(--size-leader-menu, 20rem)",
    pointerEvents: "none",
    position: "absolute",
    visibility: "hidden",
    width: "max-content",
  },
});

/** Whether a key is a letter or a digit: the keys that are not come first. */
const isLetter = (key: string) => /^[\p{L}\p{N}]$/u.test(key);

/** The entries in alphabetical order of their keys, Space and the symbols first. */
export function sortedEntries(entries: ReadonlyArray<MenuEntry>): Array<MenuEntry> {
  return entries.toSorted((a, b) => {
    if (a.key === "space" || b.key === "space") {
      return a.key === b.key ? 0 : a.key === "space" ? -1 : 1;
    }
    if (isLetter(a.key) !== isLetter(b.key)) {
      return isLetter(a.key) ? 1 : -1;
    }
    return a.key.localeCompare(b.key, "en", { sensitivity: "base" }) || (a.key < b.key ? 1 : -1);
  });
}

/** A key of the path as the title writes it: Space is `Space`, any other as typed. */
const written = (key: string) => (key === "space" ? "Space" : key);

/**
 * The menu's content on its glass, named by `path`, the keys pressed: its title, then `entries`, in
 * one column with `isNarrow`, then its back and close keys.
 */
function MenuContent({
  entries,
  isNarrow: narrow = false,
  path,
  xstyle,
}: {
  entries: ReadonlyArray<MenuEntry>;
  isNarrow?: boolean;
  path: ReadonlyArray<string>;
  xstyle?: ReadonlyArray<stylex.StyleXStyles | false>;
}) {
  const title = path.map(written).join(" ");
  return (
    <div aria-label={title} role="group" {...stylex.props(styles.box, xstyle)}>
      <Text type="supporting" xstyle={[styles.text, styles.title]}>
        {title}
      </Text>
      <ul {...stylex.props(styles.entries, narrow && styles.oneColumn)}>
        {sortedEntries(entries).map((entry) => (
          <li key={entry.key}>
            {/* oxlint-disable-next-line react/forbid-elements -- a menu's row pressed as its key is, drawn as the menu's text, its key, icon, and label in a row, with no padding or surface, which Astryx's Button does not draw (an Astryx gap) */}
            <button
              onClick={() => pressKeys(entry.key)}
              onMouseDown={keepFocus}
              type="button"
              {...stylex.props(bareButtonStyles.bare, styles.press, styles.full, brighten)}
            >
              <Text type="supporting" xstyle={[styles.entry, styles.text]}>
                <KeyCap>{entry.key}</KeyCap>
                <Icon icon={entry.icon} size="md" />
                {entry.isGroup === true ? `${entry.label} →` : entry.label}
              </Text>
            </button>
          </li>
        ))}
      </ul>
      <Text color="secondary" type="supporting" xstyle={styles.text}>
        {/* oxlint-disable-next-line react/forbid-elements -- the menu's back key, pressed as its key is, drawn as the menu's text, with no padding or surface, which Astryx's Button does not draw (an Astryx gap) */}
        <button
          onClick={() => pressKeys("Backspace")}
          onMouseDown={keepFocus}
          type="button"
          {...stylex.props(bareButtonStyles.bare, styles.press, brighten)}
        >
          <KeyCap>
            <BackGlyph />
          </KeyCap>{" "}
          back
        </button>{" "}
        {/* oxlint-disable-next-line react/forbid-elements -- the menu's close key, pressed as its key is, drawn as the menu's text, with no padding or surface, which Astryx's Button does not draw (an Astryx gap) */}
        <button
          onClick={() => pressKeys("Escape")}
          onMouseDown={keepFocus}
          type="button"
          {...stylex.props(bareButtonStyles.bare, styles.press, brighten)}
        >
          <KeyCap>esc</KeyCap> close
        </button>
      </Text>
    </div>
  );
}

/**
 * The menu at a step: `path` is the keys pressed, the first included, `entries` the next keys. It
 * slides up from the bottom as it appears, and down again once `isClosing`.
 */
export function LeaderMenu({
  entries,
  isClosing = false,
  path,
}: {
  entries: ReadonlyArray<MenuEntry>;
  isClosing?: boolean;
  path: ReadonlyArray<string>;
}) {
  const narrow = isNarrow(useWidthClass());
  // The frame's size follows the menu's natural size, which a hidden copy of the menu measures:
  // the frame eases between the sizes, since a box cannot ease between two automatic ones.
  const twin = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ height: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const natural = twin.current?.firstElementChild;
    if (narrow || !natural) {
      return undefined;
    }
    const measure = () => {
      const { height, width } = natural.getBoundingClientRect();
      setSize((was) =>
        was?.width === Math.ceil(width) && was.height === Math.ceil(height)
          ? was
          : { height: Math.ceil(height), width: Math.ceil(width) },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(natural);
    return () => observer.disconnect();
  }, [narrow]);
  return (
    <div
      {...stylex.props(
        glassStyles.surface,
        glassStyles.floating,
        styles.square,
        styles.place,
        narrow && styles.sheet,
        isClosing && styles.closing,
      )}
    >
      {narrow ? (
        <MenuContent entries={entries} isNarrow path={path} />
      ) : (
        <>
          <MenuContent
            entries={entries}
            path={path}
            xstyle={[styles.frame, size !== null && styles.sized(size.width, size.height)]}
          />
          <div aria-hidden inert ref={twin} {...stylex.props(styles.twin)}>
            <MenuContent entries={entries} path={path} />
          </div>
        </>
      )}
    </div>
  );
}
