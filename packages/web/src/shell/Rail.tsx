// The rail of semi-wide screens: 52 px of icons, which opens over the page at the column's full
// width once the mouse rests on it, to the keyboard's focus inside it, or on a tap of its logo,
// never on hover alone (UI behaviour). Escape folds it, wherever the focus is while no dialog or
// popover is open; so do the mouse leaving, the focus leaving, a tap outside, or, after a tap
// opened it, the page it opened.
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Logo } from "../Logo.tsx";
import { useLocalPath } from "../routes.tsx";

/** How long the mouse rests over the rail before it opens, in milliseconds. */
const HOVER_MS = 250;

/**
 * Whether a focus came from the keyboard, or into a field: a click on a link or a button focuses
 * it too, which must not hold the rail open once the mouse leaves.
 */
function byKeyboard(target: EventTarget) {
  try {
    return (target as Element).matches(":focus-visible");
  } catch {
    return true;
  }
}

/** Folds the rail on a tap or a click outside it, while it is open. */
function useOutside(isOpen: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const down = (event: globalThis.PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [isOpen, ref, close]);
}

/**
 * Whether a dialog or a popover is open, which Escape closes before the rail: a manual popover,
 * like the toasts' region, is open on every page, and Escape never closes it.
 */
function isOverlayOpen() {
  try {
    return document.querySelector('dialog[open], :popover-open:not([popover="manual"])') !== null;
  } catch {
    return document.querySelector("dialog[open]") !== null;
  }
}

/**
 * Folds the rail on Escape pressed outside it, while it is open: a hover opens it with the focus
 * anywhere on the page. Escape inside it is the rail's own, and one a dialog or a popover took is
 * theirs.
 */
function useEscape(isOpen: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const down = (event: globalThis.KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        ref.current?.contains(target) ||
        target?.closest?.("dialog, [popover], [role='dialog']") ||
        isOverlayOpen()
      ) {
        return;
      }
      close();
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [isOpen, ref, close]);
}

/**
 * The row of the open rail that stands for `folded`, a row of the folded rail its focus reached:
 * the link to the same page, or the control of the same name.
 */
function matchingRow(nav: HTMLElement, folded: Element): HTMLElement | null {
  const href = folded.getAttribute("href");
  const label = folded.getAttribute("aria-label");
  return (
    (href === null ? null : nav.querySelector<HTMLElement>(`a[href="${CSS.escape(href)}"]`)) ??
    (label === null ? null : nav.querySelector<HTMLElement>(`[aria-label="${CSS.escape(label)}"]`))
  );
}

/**
 * Keeps the keyboard's focus on its row as the rail opens: the folded rail's icon is not the open
 * rail's row, so the element focused goes as the rail opens, and its row takes the focus.
 */
function useKeepFocus(isOpen: boolean, ref: RefObject<HTMLElement | null>) {
  const folded = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const row = folded.current;
    folded.current = null;
    if (isOpen && row && !row.isConnected && ref.current) {
      matchingRow(ref.current, row)?.focus();
    }
  }, [isOpen, ref]);
  /** Remembers the folded rail's row the keyboard focused. */
  return (row: EventTarget) => {
    folded.current = row as Element;
  };
}

/**
 * The rail's state, while `isRail`: whether it is open, the handlers its element, `ref`, takes, and
 * the logo's tap; Escape moves the focus to `logo`. `isHovered` follows the mouse over it at every
 * width, which shows the wide column's fold button.
 */
export function useRail(
  isRail: boolean,
  ref: RefObject<HTMLElement | null>,
  logo: RefObject<HTMLButtonElement | null>,
) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tapped, setTapped] = useState(false);
  // After Escape, the focus it moved to the logo, and any focus until it leaves, keeps it folded.
  const quiet = useRef(false);
  // The mouse's rest over the rail, which opens it.
  const intent = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(intent.current), []);
  const isOpen = isRail && (hovered || focused || tapped);
  const [close] = useState(() => () => {
    setHovered(false);
    setFocused(false);
    setTapped(false);
  });
  useOutside(isOpen, ref, close);
  useEscape(isOpen, ref, close);
  const remember = useKeepFocus(isOpen, ref);
  // The page a tap opened folds the rail it was opened from.
  const path = useLocalPath();
  const [at, setAt] = useState(path);
  if (at !== path) {
    setAt(path);
    setTapped(false);
  }
  const handlers = {
    onBlur: (event: FocusEvent) => {
      if (!ref.current?.contains(event.relatedTarget as Node | null)) {
        quiet.current = false;
        setFocused(false);
      }
    },
    onFocus: (event: FocusEvent) => {
      if (!quiet.current && byKeyboard(event.target)) {
        if (!isOpen) {
          remember(event.target);
        }
        setFocused(true);
      }
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        quiet.current = true;
        clearTimeout(intent.current);
        close();
        logo.current?.focus();
      }
    },
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        // Once the mouse rests: a click on an icon on its way lands on that icon, not on the row
        // the opened rail draws there.
        clearTimeout(intent.current);
        intent.current = setTimeout(() => setHovered(true), HOVER_MS);
      }
    },
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        clearTimeout(intent.current);
        setHovered(false);
      }
    },
  };
  /** The logo's tap: it opens the rail, or folds it when open. */
  const tap = () => {
    clearTimeout(intent.current);
    if (isOpen) {
      close();
    } else {
      setTapped(true);
    }
  };
  return { handlers, isHovered: hovered, isOpen, tap };
}

/** The rail's logo: a tap opens the rail over the page, which has no pointer to hover it with. */
export function LogoButton({
  isOpen,
  onTap,
  ref,
}: {
  isOpen: boolean;
  onTap: () => void;
  ref: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <IconButton
      aria-expanded={isOpen}
      icon={<Logo />}
      label="Open navigation"
      onClick={onTap}
      ref={ref}
      variant="ghost"
    />
  );
}
