// The registry of the status line's hints: a page, a list, or the shell declares the keys that work
// while it shows, and its hints leave the line as it unmounts, so no page's hints outlive it. A sheet
// that leaves the page usable says it covers the line, which then steps aside: such a sheet is not
// in the top layer, and the fixed line would cover its foot.
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

/** A key that works, and what it does, as the status line shows it: "j k" "move". */
export type StatusHint = { keys: string; label: string };

/** Who declares hints: a page or a list, shown first, or the shell, shown after them. */
type Place = "page" | "shell";

type Declared = { hints: ReadonlyArray<StatusHint>; id: string; place: Place };

type Declare = (id: string, place: Place, hints: ReadonlyArray<StatusHint> | null) => void;

const DeclareContext = createContext<Declare>(() => {});
const HintsContext = createContext<ReadonlyArray<StatusHint>>([]);
const CoverContext = createContext<(by: string, isCovering: boolean) => void>(() => {});
const CoveredContext = createContext(false);

/** The shell's side of the registry: what is declared under it, for `useDeclaredHints`. */
export function StatusHintsProvider({ children }: { children: ReactNode }) {
  const [declared, setDeclared] = useState<ReadonlyArray<Declared>>([]);
  const [covers, setCovers] = useState<ReadonlySet<string>>(new Set());
  const cover = useCallback((by: string, isCovering: boolean) => {
    setCovers((before) => {
      if (before.has(by) === isCovering) {
        return before;
      }
      const after = new Set(before);
      if (isCovering) {
        after.add(by);
      } else {
        after.delete(by);
      }
      return after;
    });
  }, []);
  const declare = useCallback<Declare>((id, place, hints) => {
    setDeclared((before) => {
      if (hints === null) {
        return before.filter((entry) => entry.id !== id);
      }
      // A declarer whose hints change keeps its place; a new one comes last.
      const entry = { hints, id, place };
      return before.some((declared) => declared.id === id)
        ? before.map((declared) => (declared.id === id ? entry : declared))
        : [...before, entry];
    });
  }, []);
  const hints = useMemo(
    () =>
      (["page", "shell"] as const).flatMap((place) =>
        declared.filter((entry) => entry.place === place).flatMap((entry) => entry.hints),
      ),
    [declared],
  );
  return (
    <DeclareContext value={declare}>
      <CoverContext value={cover}>
        <CoveredContext value={covers.size > 0}>
          <HintsContext value={hints}>{children}</HintsContext>
        </CoveredContext>
      </CoverContext>
    </DeclareContext>
  );
}

/** The hints declared now: the pages' first, in the order they were declared, then the shell's. */
export function useDeclaredHints() {
  return use(HintsContext);
}

/**
 * Declares the keys that work while the caller shows: an empty list for none, as a key that is off
 * at this width. Outside the shell, as in a story, declares nothing.
 */
export function useStatusHints(hints: ReadonlyArray<StatusHint>, place: Place = "page") {
  const declare = use(DeclareContext);
  const id = useId();
  // By their text: a list written inline in the caller is the same list at every render.
  const text = JSON.stringify(hints);
  useLayoutEffect(() => {
    declare(id, place, JSON.parse(text) as ReadonlyArray<StatusHint>);
  }, [declare, id, place, text]);
  useLayoutEffect(() => () => declare(id, place, null), [declare, id, place]);
}

/** Whether a sheet covers the status line now. */
export function useStatusLineCovered() {
  return use(CoveredContext);
}

/** Says the caller, a sheet that leaves the page usable, covers the status line while `isCovering`. */
export function useCoverStatusLine(isCovering: boolean) {
  const cover = use(CoverContext);
  const id = useId();
  useLayoutEffect(() => {
    cover(id, isCovering);
  }, [cover, id, isCovering]);
  useLayoutEffect(() => () => cover(id, false), [cover, id]);
}
