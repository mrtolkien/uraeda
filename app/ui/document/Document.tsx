// A document: the core's tree of a workflow file, drawn block by block. It never reads Markdown:
// the server sends the tree the core read (the stack decision). Its prose keeps a measure of about
// 80 characters, centred in a wider pane, or from its left edge with `align="start"`; code,
// tables, and diagrams may take the room to its right edge.
import { computed, type JSX, signal, View } from "nsh";
import type { Document as Tree } from "../../store/protocol";
import { Blocks, read } from "./Blocks";
import { DocumentContext, type DocumentHands } from "./context";
import { measure } from "./look";

export type DocumentProps = DocumentHands & {
  /** The core's tree: the record `WorkflowFile`'s `current.document`. */
  document: Tree;
  /** The blocks of its top level to draw, by id, in order: all of them by default. */
  ids?: ReadonlyArray<number>;
  /** `center`, the default: the prose in the middle of a wider pane. `start`: at its left edge. */
  align?: "center" | "start";
  testID?: string;
};

/**
 * What a `Document` and a `Reply` share: the width they are laid out at, and where their prose
 * starts, given to every block with the screen's hands.
 */
export function Measured(
  props: DocumentHands & { align?: "center" | "start"; children?: JSX.Element; testID?: string },
) {
  const width = signal(0);
  const inset = () =>
    props.align === "start" ? 0 : Math.max(0, Math.floor((width() - measure()) / 2));
  const shared = {
    get image() {
      return props.image;
    },
    inset,
    get mark() {
      return props.mark;
    },
    get onLink() {
      return props.onLink;
    },
    get override() {
      return props.override;
    },
    width,
  };
  return (
    <DocumentContext.Provider value={shared}>
      <View
        onLayout={(event) => width.set(event.bounds.size.width)}
        style={{ paddingLeft: inset() }}
        testID={props.testID}
      >
        {props.children}
      </View>
    </DocumentContext.Provider>
  );
}

export function Document(props: DocumentProps) {
  const tree = computed(() => read(props.document));
  return (
    <Measured
      align={props.align}
      image={props.image}
      mark={props.mark}
      onLink={props.onLink}
      override={props.override}
      testID={props.testID}
    >
      <Blocks ids={props.ids} read={tree()} />
    </Measured>
  );
}
