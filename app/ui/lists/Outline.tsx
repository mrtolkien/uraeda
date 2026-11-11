// A document's outline: its headings, one row each, indented by level under the shallowest, the
// part being read, `here`, marked as what is open. Every reader of the app draws its outline with
// it: a workflow file's, and a Markdown buffer's, which follows the text typed.
import { View } from "nsh";
import type { Cursor } from "./cursor";
import { Empty } from "./Empty";
import { Line } from "./Line";
import { List } from "./List";

/** A heading of the outline: `id` is the cursor's. */
export type OutlineHeading = { id: string; level: number; title: string };

export type OutlineProps = {
  cursor: Cursor;
  /** By id, for the rows: the same headings as the cursor's items, in their order. */
  heading: (id: string) => OutlineHeading | undefined;
  /** The heading of the part being read, when the reader says it. */
  here?: () => string | undefined;
  /** The shallowest level listed, which sits at the left edge: 2 when a file's title is aside. */
  top: number;
  onOpen: (id: string) => void;
  /** What `Enter` says in the key map. */
  openLabel?: string;
  /** Why it is empty, in the reader's words. */
  emptyWords: string;
  testID?: string;
};

/** How far in each level below the top goes, in points. */
const STEP = 16;

export function Outline(props: OutlineProps) {
  return (
    <List
      cursor={props.cursor}
      empty={<Empty icon="list" title="No parts" words={props.emptyWords} />}
      onOpen={props.onOpen}
      openLabel={props.openLabel ?? "go to the part"}
      row={(id) => {
        const heading = () => props.heading(id());
        const lit = () => props.here?.() === id();
        const deeper = () => Math.max(0, (heading()?.level ?? props.top) - props.top);
        return (
          <View style={{ flex: 1, flexDirection: "row", paddingLeft: STEP * deeper() }}>
            <Line
              current={lit()}
              icon={lit() ? "circle-dot" : "minus"}
              label={heading()?.title ?? ""}
              quiet={!lit() && deeper() > 0}
            />
          </View>
        );
      }}
      testID={props.testID}
    />
  );
}
