// A table: rows of the same facts, in columns with their titles, for what is compared down a
// column, as accounts and their usage, or runs and their costs. Its rows are a list's: the same
// cursor, keys, selection, and `Enter`. On a narrow window a row is a block: its first column on a
// line of its own, then each other column's title and value at the full width, never a column
// squeezed to a word a line.
import { type JSX, View } from "nsh";
import { Text } from "../controls";
import { tokens } from "../tokens";
import { isNarrow } from "../width";
import type { Cursor } from "./cursor";
import { listKeys } from "./keys";
import { Row } from "./Row";

export type Column = {
  /** Numbers and times are at the end, to be compared. */
  align?: "start" | "end";
  key: string;
  title: string;
  /** Its width in points; else it shares what is left. */
  width?: number;
};

export type TableProps = {
  /** What a cell shows: words, or a mark. */
  cell: (id: string, column: string) => JSX.Element;
  columns: ReadonlyArray<Column>;
  cursor: Cursor;
  empty?: JSX.Element;
  keys?: boolean;
  onOpen?: (id: string) => void;
  testID?: string;
};

const sized = (column: Column) =>
  column.width === undefined ? { flex: 1, minWidth: 0 } : { flexShrink: 0, width: column.width };

function Wide(props: TableProps) {
  return (
    <>
      <View
        style={{
          borderBottomColor: tokens.role.rule,
          borderBottomWidth: 1,
          flexDirection: "row",
          gap: 12,
          minHeight: tokens.space.row,
          paddingHorizontal: 8,
          alignItems: "center",
        }}
      >
        <Each of={props.columns}>
          {(column) => (
            <View
              style={[
                sized(column()),
                { alignItems: column().align === "end" ? "flex-end" : "flex-start" },
              ]}
            >
              <Text bold size="under" tone="quiet">
                {column().title}
              </Text>
            </View>
          )}
        </Each>
      </View>
      <Each key={(item: { id: string }) => item.id} of={props.cursor.items()}>
        {(item) => (
          <Row
            onPoint={() => props.cursor.set(item().id)}
            onPress={() => {
              props.cursor.set(item().id);
              props.onOpen?.(item().id);
            }}
            rule
            selected={props.cursor.holds(item().id)}
            style={{ gap: 12 }}
          >
            <Each of={props.columns}>
              {(column) => (
                <View
                  style={[
                    sized(column()),
                    { alignItems: column().align === "end" ? "flex-end" : "flex-start" },
                  ]}
                >
                  {props.cell(item().id, column().key)}
                </View>
              )}
            </Each>
          </Row>
        )}
      </Each>
    </>
  );
}

function Narrow(props: TableProps) {
  const [head, ...rest] = props.columns;
  return (
    <Each key={(item: { id: string }) => item.id} of={props.cursor.items()}>
      {(item) => (
        <Row
          onPress={() => {
            props.cursor.set(item().id);
            props.onOpen?.(item().id);
          }}
          rule
          selected={props.cursor.holds(item().id)}
          style={{ alignItems: "stretch", flexDirection: "column", gap: 2, paddingVertical: 6 }}
        >
          <If when={head}>{(column) => props.cell(item().id, column().key)}</If>
          <Each of={rest}>
            {(column) => (
              <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                <View style={{ width: 110 }}>
                  <Text size="under" tone="faint">
                    {column().title}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>{props.cell(item().id, column().key)}</View>
              </View>
            )}
          </Each>
        </Row>
      )}
    </Each>
  );
}

export function Table(props: TableProps) {
  if (props.keys !== false) {
    listKeys(props.cursor, { onOpen: props.onOpen });
  }
  return (
    <View testID={props.testID}>
      <If when={props.cursor.items().length > 0} else={props.empty}>
        <If when={isNarrow()} else={<Wide {...props} />}>
          <Narrow {...props} />
        </If>
      </If>
    </View>
  );
}
