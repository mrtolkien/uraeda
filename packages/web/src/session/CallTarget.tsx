// What an activity row acted on, its command, path, or pattern, under the row's head across the
// row's whole width: three lines at most, a longer one cut in its middle around "[...]", which shows
// it whole. The lines a row has room for are counted from the list's width and its text's
// characters, and a clamp at three lines keeps a miscount from growing the row.
import { Link } from "@astryxdesign/core/Link";
import { fontWeightVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Path } from "./Path.tsx";

const styles = stylex.create({
  // Breaks after its slashes first, then anywhere, as the changes' paths, in the row's text at its
  // own weight, not a fold's toggle's bolder one; no width of its own, so it wraps rather than
  // widening the list.
  target: {
    contain: "inline-size",
    display: "block",
    fontSize: typeScaleVars["--text-body-size"],
    fontWeight: fontWeightVars["--font-weight-normal"],
    lineHeight: typeScaleVars["--text-body-leading"],
    overflowWrap: "anywhere",
    textAlign: "start",
  },
  // Three lines at most, whatever the count missed.
  clamped: {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 3,
  },
  // A target shown whole, its lines kept, as a script's are.
  whole: { whiteSpace: "pre-wrap" },
  // Where a long target is cut: "[...]" in the links' color, as it shows the rest when clicked,
  // set apart by a space on each side, where a line breaks rather than inside a word.
  cut: {
    color: colorVars["--color-text-accent"],
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  // The list's box, which holds the ruler: placed in it, at its top, it never reaches past a
  // scroller around the list.
  room: { position: "relative" },
  // Ten characters of the row's text, unseen, which measure a character's width.
  ruler: {
    fontSize: typeScaleVars["--text-body-size"],
    insetBlockStart: 0,
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
  },
});

/** The lines a target shows at most before it is cut. */
const LINES = 3;

/** The characters a line of a target holds, as the list measures them: a guess before it does. */
const LineChars = createContext(40);

/** Where a word of a command ends: a space, or a mark between its parts. */
const BETWEEN = /[\s;|&,()'"=]/;

/**
 * `text` on one line, or, longer than `most` characters, its start and its end, about half each,
 * cut between words where one ends near enough, rather than inside a name.
 */
function cutMiddle(text: string, most: number): { head: string; tail?: string } {
  const line = text.replaceAll(/\s+/g, " ").trim();
  if (line.length <= most) {
    return { head: line };
  }
  const half = Math.floor(most / 2);
  const slack = Math.floor(half / 3);
  let headEnd = half;
  while (headEnd > half - slack && !BETWEEN.test(line.charAt(headEnd))) {
    headEnd -= 1;
  }
  let tailStart = line.length - half;
  while (tailStart < line.length - half + slack && !BETWEEN.test(line.charAt(tailStart - 1))) {
    tailStart += 1;
  }
  const head = BETWEEN.test(line.charAt(headEnd)) ? headEnd : half;
  const tail = BETWEEN.test(line.charAt(tailStart - 1)) ? tailStart : line.length - half;
  return { head: line.slice(0, head).trimEnd(), tail: line.slice(tail).trimStart() };
}

/**
 * What a row acted on, cut in its middle past three lines around "[...]", which calls `onWhole`
 * when the row has a fold to open, and shows it whole here otherwise. `isWhole` shows it whole.
 */
export function CallTarget({
  isWhole = false,
  label,
  onWhole,
}: {
  isWhole?: boolean;
  label: string;
  onWhole?: () => void;
}) {
  const [isShown, setShown] = useState(false);
  const chars = useContext(LineChars);
  // A line wraps before its last characters where a word does not fit: a sixth of it is kept back.
  const { head, tail } = cutMiddle(label, Math.max(24, Math.floor((LINES * chars * 5) / 6) - 7));
  if (isWhole || isShown || tail === undefined) {
    return (
      <span {...stylex.props(styles.target, tail !== undefined && styles.whole)}>
        <Path inText path={tail === undefined ? head : label} />
      </span>
    );
  }
  return (
    <span {...stylex.props(styles.target, styles.clamped)}>
      <Path inText path={head} />{" "}
      <Link
        aria-label="Show it whole"
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          if (onWhole) {
            onWhole();
          } else {
            setShown(true);
          }
        }}
        type="inherit"
        xstyle={styles.cut}
      >
        [...]
      </Link>{" "}
      <Path inText path={tail} />
    </span>
  );
}

/** The characters a line of `box`'s rows holds, in `ruler`'s, as its width changes. */
function useLineChars(box: RefObject<HTMLElement | null>, ruler: RefObject<HTMLElement | null>) {
  const [chars, setChars] = useState(40);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const char = (ruler.current?.getBoundingClientRect().width ?? 0) / 10;
      const width = element.getBoundingClientRect().width;
      if (char > 0 && width > 0) {
        setChars(Math.max(12, Math.floor(width / char)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box, ruler]);
  return chars;
}

/** Counts the characters a line of its rows' targets holds, from its width, for `CallTarget`. */
export function LineCharsRoom({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const ruler = useRef<HTMLSpanElement>(null);
  const chars = useLineChars(box, ruler);
  return (
    <div ref={box} {...stylex.props(styles.room)}>
      <span aria-hidden="true" ref={ruler} {...stylex.props(styles.ruler)}>
        0000000000
      </span>
      <LineChars value={chars}>{children}</LineChars>
    </div>
  );
}
