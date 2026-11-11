// The document renderer's gallery pages, on the real renderer: `spec`, a document with every kind
// of block and span; `diagrams`, one drawn and one that fails; `reply`, a long reply growing by
// itself from the moment its host says `grow`. Its host names the page and the theme. `just
// gallery-shots document` takes their pictures in both themes, at a desktop's and a phone's width,
// and `just document-frames` times the reply growing.
import { colorScheme, host, mount, Scroll, type ScrollRef, type Signal, signal, View } from "nsh";
import { markdownTree } from "uraeda/native";
import type { Document as Tree } from "../../store/protocol";
import { Document, Reply } from "../../ui/document";
import { Backdrop, Pane } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, tokensOf } from "../../ui/tokens";
import { DIAGRAMS, longReply, ROW_SVG, SPEC } from "./sample";

const tree = (text: string) => JSON.parse(markdownTree(text)) as Tree;

/** The gallery's images: the prototype's picture; any other is a link. */
const image = (shown: { path: string | null }) =>
  shown.path?.endsWith("mockups/row.svg") === true ? ROW_SVG : undefined;

/** The page's scroll: the reply's follows its end as it grows, as a transcript does. */
let scroll: ScrollRef | undefined;

/** Grows `text` by `piece` characters of `whole` a frame, following its end, until it is whole. */
function grow(text: Signal<string>, whole: string, piece: number) {
  const next = text().length + piece;
  text.set(whole.slice(0, next));
  scroll?.scrollToEnd({ animated: false });
  if (next < whole.length) requestAnimationFrame(() => grow(text, whole, piece));
}

/** A reply that grows by `piece` characters a frame once its host says `grow`, until it is whole. */
function Growing(props: { piece: number; text: string }) {
  const text = signal(props.text.slice(0, 400));
  const done = signal(false);
  host.on("grow", () => requestAnimationFrame(() => grow(text, props.text, props.piece)));
  host.on("end", () => done.set(true));
  return <Reply done={done} image={image} text={text} />;
}

function Page() {
  showTokens(tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]));
  const page = String(host.params.page ?? "spec");
  const body = () => {
    if (page === "reply")
      return (
        <Growing
          piece={Number(host.params.piece ?? 12)}
          text={longReply(Number(host.params.sections ?? 8))}
        />
      );
    return <Document document={tree(page === "diagrams" ? DIAGRAMS : SPEC)} image={image} />;
  };
  return (
    <Backdrop>
      <View style={{ flex: 1, padding: 8 }}>
        <Pane
          body={{ flex: 1 }}
          style={{ flex: 1 }}
          title={page === "reply" ? "A reply" : `${page}.md`}
        >
          <Scroll ref={(ref) => (scroll = ref)} style={{ flex: 1 }} testID="scroll">
            {body()}
          </Scroll>
        </Pane>
      </View>
    </Backdrop>
  );
}

mount(Page);
