// The status line's cover: a sheet that leaves the page usable says it covers the line, which then
// steps aside: such a sheet is not in the top layer, and the fixed line would cover its foot. The
// line's hints are the key registry's (`keys/registry.tsx`).
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useState,
} from "react";

const CoverContext = createContext<(by: string, isCovering: boolean) => void>(() => {});
const CoveredContext = createContext(false);

/** The shell's side of the cover: whether any sheet under it covers the status line now. */
export function StatusLineCoverProvider({ children }: { children: ReactNode }) {
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
  return (
    <CoverContext value={cover}>
      <CoveredContext value={covers.size > 0}>{children}</CoveredContext>
    </CoverContext>
  );
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
