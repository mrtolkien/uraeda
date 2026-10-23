import { createContext, type ReactNode, use, useLayoutEffect } from "react";

const SetSlot = createContext<(content: ReactNode) => void>(() => {});

/** The shell's side of the slot: `onChange` receives what the current page puts in it. */
export function TopBarSlotProvider({
  children,
  onChange,
}: {
  children: ReactNode;
  onChange: (content: ReactNode) => void;
}) {
  return <SetSlot value={onChange}>{children}</SetSlot>;
}

/**
 * A page's own controls in the shell's status line, at the bottom of the window, as the round's
 * count and Next on the phone. Empty unless the current page renders one.
 */
export function TopBarSlot({ children }: { children: ReactNode }) {
  const set = use(SetSlot);
  useLayoutEffect(() => {
    set(children);
  }, [set, children]);
  useLayoutEffect(() => () => set(null), [set]);
  return null;
}
