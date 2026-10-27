// The leader menu: the keys pressed so far in the title of a bordered pane, then what each next key
// does, each with its icon, a group marked by an arrow, in alphabetical order of their keys. It sits
// at the window's bottom right, above the status line, and on narrow screens spans the window's
// width, as the UI layout decision's sheets do. `LeaderMenuHost` feeds it the registry's step.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { easeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, useLayoutEffect, useRef, useState } from "react";
import { Pane } from "../layout/Pane.tsx";
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
  },
  entry: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-2"],
  },
  // The pane's frame, which eases to the size the menu's step needs. The content stays at the
  // frame's top left and is clipped to it, but for the title over the top border.
  // A row or a footer key that presses its key when clicked, as a link in the text.
  press: {
    background: "none",
    border: "none",
    color: "inherit",
    font: "inherit",
    padding: 0,
    textAlign: "start",
  },
  full: {
    display: "block",
    width: "100%",
  },
  frame: {
    boxSizing: "border-box",
    clipPath: "inset(-1lh 0 0 0)",
    transitionDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s",
      default: `${SLIDE_MS}ms`,
    },
    transitionProperty: "height, width",
    transitionTimingFunction: easeVars["--ease-standard"],
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
    minWidth: "var(--size-leader-menu, 16rem)",
    position: "fixed",
    zIndex: 3,
  },
  sheet: {
    insetInline: spacingVars["--spacing-2"],
    minWidth: 0,
  },
  sized: (width: number, height: number) => ({
    height: `${height}px`,
    width: `${width}px`,
  }),
  // A copy of the menu at its natural size, unseen, which `size` is measured on.
  twin: {
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    minWidth: "var(--size-leader-menu, 16rem)",
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

/** A key as the menu draws it: Space is its glyph, any other the key as typed. */
function Key({ name }: { name: string }) {
  return <KeyCap>{name}</KeyCap>;
}

/** A key of the path as the title writes it: Space is `Space`, any other as typed. */
const written = (key: string) => (key === "space" ? "Space" : key);

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
  const pane = (xstyle?: ComponentProps<typeof Pane>["xstyle"]) => (
    <Pane isActive isGroup title={path.map(written).join(" ")} xstyle={xstyle}>
      <ul {...stylex.props(styles.entries, narrow && styles.oneColumn)}>
        {sortedEntries(entries).map((entry) => (
          <li key={entry.key}>
            <button
              onClick={() => pressKeys(entry.key)}
              onMouseDown={keepFocus}
              type="button"
              {...stylex.props(styles.press, styles.full, brighten)}
            >
              <Text type="supporting" xstyle={styles.entry}>
                <Key name={entry.key} />
                <Icon icon={entry.icon} size="sm" />
                {entry.isGroup === true ? `${entry.label} →` : entry.label}
              </Text>
            </button>
          </li>
        ))}
      </ul>
      <Text color="secondary" type="supporting">
        <button
          onClick={() => pressKeys("Backspace")}
          onMouseDown={keepFocus}
          type="button"
          {...stylex.props(styles.press, brighten)}
        >
          <KeyCap>
            <BackGlyph />
          </KeyCap>{" "}
          back
        </button>{" "}
        <button
          onClick={() => pressKeys("Escape")}
          onMouseDown={keepFocus}
          type="button"
          {...stylex.props(styles.press, brighten)}
        >
          <KeyCap>esc</KeyCap> close
        </button>
      </Text>
    </Pane>
  );
  return (
    <div {...stylex.props(styles.place, narrow && styles.sheet, isClosing && styles.closing)}>
      {narrow ? (
        pane()
      ) : (
        <>
          {pane([styles.frame, size !== null && styles.sized(size.width, size.height)])}
          <div aria-hidden inert ref={twin} {...stylex.props(styles.twin)}>
            {pane()}
          </div>
        </>
      )}
    </div>
  );
}
