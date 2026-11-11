// A tree: rows nested under rows, as a change's files under their folders. It is a list of the
// rows it shows, in order, each at its depth: `treeRows(nodes, folded)` makes them, and the screen
// makes its cursor over them, so the cursor, the keys, and the selection are a list's. A folder's
// chevron folds it, as `Enter` does on it; on a leaf `Enter` is the row's own. What is folded is
// the screen's to keep, in the visit's entry, and a fold glides.
import { type JSX, View } from "nsh";
import { Icon, type IconName, Text } from "../controls";
import { registerKey } from "../keys/registry";
import { tokens } from "../tokens";
import type { Cursor } from "./cursor";
import { glide } from "./glide";
import { listKeys } from "./keys";
import { Row } from "./Row";

export type TreeNode = {
  readonly children?: ReadonlyArray<TreeNode>;
  readonly hue?: string;
  readonly icon?: IconName;
  readonly id: string;
  readonly label: string;
  /** A quiet fact at the row's end: "+12 −3". */
  readonly meta?: string;
};

/** A row of a tree as it shows: its node, its depth, and whether it holds others. */
export type TreeRow = { readonly id: string; depth: number; node: TreeNode; folder: boolean };

/** The rows a tree shows, in order: every node whose folders above it are open. */
export function treeRows(
  nodes: ReadonlyArray<TreeNode>,
  folded: ReadonlySet<string>,
  depth = 0,
): Array<TreeRow> {
  return nodes.flatMap((node) => {
    const folder = node.children !== undefined;
    const row: TreeRow = { depth, folder, id: node.id, node };
    return folder && !folded.has(node.id)
      ? [row, ...treeRows(node.children ?? [], folded, depth + 1)]
      : [row];
  });
}

export type TreeProps = {
  cursor: Cursor<TreeRow>;
  empty?: JSX.Element;
  folded: ReadonlySet<string>;
  /** Folds a folder, or opens it: the screen keeps the set. */
  onFold: (id: string, folded: boolean) => void;
  /** A leaf's own action. */
  onOpen?: (id: string) => void;
  testID?: string;
};

/** How far a level is set in, in points: an icon and its gap. */
const STEP = 16;

export function Tree(props: TreeProps) {
  const cursor = props.cursor;
  const fold = (id: string) => {
    glide();
    props.onFold(id, !props.folded.has(id));
  };
  const rowOf = (id: string) => cursor.items().find((row) => row.id === id);
  const open = (id: string) => {
    if (rowOf(id)?.folder === true) {
      fold(id);
    } else {
      props.onOpen?.(id);
    }
  };
  listKeys(cursor);
  registerKey({
    keys: "Enter",
    label: "open, or fold",
    run: () => {
      const id = cursor.at();
      if (id === undefined) {
        return false;
      }
      open(id);
      return undefined;
    },
  });
  return (
    <View testID={props.testID}>
      <If when={cursor.items().length > 0} else={props.empty}>
        <Each key={(row: TreeRow) => row.id} of={cursor.items()}>
          {(row) => (
            <Row
              onPoint={() => cursor.set(row().id)}
              onPress={() => {
                cursor.set(row().id);
                open(row().id);
              }}
              selected={cursor.holds(row().id)}
              style={{ paddingLeft: 8 + row().depth * STEP }}
            >
              <View style={{ width: tokens.control.icon }}>
                <If when={row().folder}>
                  <Icon
                    name={props.folded.has(row().id) ? "chevron-right" : "chevron-down"}
                    size={14}
                  />
                </If>
              </View>
              <Icon
                colour={row().node.hue}
                name={row().node.icon ?? (row().folder ? "folder" : "file-text")}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text>{row().node.label}</Text>
              </View>
              <If when={row().node.meta}>{(meta) => <Text tone="faint">{meta()}</Text>}</If>
            </Row>
          )}
        </Each>
      </If>
    </View>
  );
}
