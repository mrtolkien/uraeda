// A short list, every row of it made, in the flow of what holds it: a pane's rows, a sidebar's, a
// menu of places. It has the same cursor, keys, selection, and rows as `VirtualList`, which a list
// of more than a few hundred rows takes instead. It does not scroll on its own: its pane does.
//
// Rows are kept by their id: an item's own change redraws its row alone. A change the screen makes
// itself, an insert or a remove, glides when the screen calls `glide()` just before it.
import { type Accessor, type JSX, type StyleProp, View, type ViewStyle } from "nsh";
import type { Cursor } from "./cursor";
import { listKeys } from "./keys";
import { Row } from "./Row";

export type ListProps = {
  cursor: Cursor;
  /** Shown in place of the rows while there are none: an `Empty`, which says why. */
  empty?: JSX.Element;
  /** Declares its keys in the scope around it: true unless the screen declares its own. */
  keys?: boolean;
  /** The row's own action: `Enter`, and a press. */
  onOpen?: (id: string) => void;
  openLabel?: string;
  /** Draws a row's content. */
  row: (id: Accessor<string>, index: Accessor<number>) => JSX.Element;
  /** A quiet line between rows. */
  rules?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function List(props: ListProps) {
  const cursor = props.cursor;
  if (props.keys !== false) {
    listKeys(cursor, { onOpen: props.onOpen, openLabel: props.openLabel });
  }
  return (
    <View style={props.style} testID={props.testID}>
      <If when={cursor.items().length > 0} else={props.empty}>
        <Each key={(item: { id: string }) => item.id} of={cursor.items()}>
          {(item, index) => (
            <Row
              onPoint={() => cursor.set(item().id)}
              onPress={() => {
                cursor.set(item().id);
                props.onOpen?.(item().id);
              }}
              rule={props.rules}
              selected={cursor.holds(item().id)}
            >
              {props.row(() => item().id, index)}
            </Row>
          )}
        </Each>
      </If>
    </View>
  );
}
