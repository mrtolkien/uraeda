// The box a comment is written in, under the part it is on, on wide screens: a pane titled
// "Comment", as a spec's lines and a round's settled points draw it (UI components). On the phone,
// the form shows in a sheet instead.
import type { ReactNode } from "react";
import { Pane } from "./Pane.tsx";

/**
 * A comment's form under its part: a group, so it adds no landmark to the page's list, its title a
 * level under the panes of a document or a round it sits in.
 */
export function CommentBox({ children }: { children: ReactNode }) {
  return (
    <Pane isGroup level={3} title="Comment">
      {children}
    </Pane>
  );
}
