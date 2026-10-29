// What a pane tells its content (`Pane.tsx`): that it is inside a pane, and the pane's tone.
import { createContext, type ReactNode, use } from "react";
import type { PaneTone } from "./Pane.tsx";

/** Whether inside a pane: a pane there keeps its borders on the phone too. */
export const InPane = createContext(false);

/** The tone of the pane around, which the closed rail's card frames take (`ItemCard`). */
const ToneOfPane = createContext<PaneTone | undefined>(undefined);

/** A pane's content: inside a pane, of the pane's `tone`. */
export function PaneContent({ children, tone }: { children: ReactNode; tone?: PaneTone }) {
  return (
    <InPane value>
      <ToneOfPane value={tone}>{children}</ToneOfPane>
    </InPane>
  );
}

/** Whether inside a pane's content, as the column's Navigate rows are, and not its foot's. */
export function useInPane() {
  return use(InPane);
}

/** The tone of the pane around. */
export function usePaneTone() {
  return use(ToneOfPane);
}
