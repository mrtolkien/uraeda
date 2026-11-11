// An agent's reply as it streams: a list of blocks, each drawn once as it finishes, and the last
// one, still being written, as plain text, or as code while its fence is open. Rust splits the
// text (`ReplySplitter`), reading each appended piece once: TSX never scans the reply, and a
// finished block never draws again while the last one grows.
import { type Accessor, batch, effect, signal, Text, untracked, View } from "nsh";
import { type ReplySplit, ReplySplitter } from "uraeda/native";
import type { Document as Tree } from "../../store/protocol";
import { Blocks, read, type Read } from "./Blocks";
import { Code } from "./Code";
import type { DocumentHands } from "./context";
import { Measured } from "./Document";
import { BLOCK_GAP, measure, prose } from "./look";

export type ReplyProps = DocumentHands & {
  /**
   * The reply so far: a text that grows by appends. A text shorter than the one before is
   * another reply, read from its start.
   */
  text: Accessor<string>;
  /** Whether the reply is whole: its last block is then finished too. */
  done?: Accessor<boolean>;
  align?: "center" | "start";
  testID?: string;
};

type Finished = { key: number; read: Read };
type Growing = { code: boolean; language: string; text: string };

const NOTHING: Growing = { code: false, language: "", text: "" };

/** Whether the last unit of a piece is the first half of a character, which waits for its rest. */
const cut = (piece: string) => {
  const last = piece.charCodeAt(piece.length - 1);
  return last >= 0xd800 && last <= 0xdbff;
};

export function Reply(props: ReplyProps) {
  let splitter = new ReplySplitter();
  /** How much of the text the splitter read, in UTF-16 units, and whether it heard the end. */
  let fed = 0;
  let ended = false;
  let next = 0;
  const finished = signal<ReadonlyArray<Finished>>([]);
  const growing = signal<Growing>(NOTHING);

  const take = (split: ReplySplit) =>
    batch(() => {
      if (split.finished.length > 0) {
        const added = split.finished.map((json) => ({
          key: next++,
          read: read(JSON.parse(json) as Tree),
        }));
        finished.set([...finished(), ...added]);
      }
      growing.set({ code: split.code, language: split.language, text: split.growing });
    });

  effect(() => {
    const text = props.text();
    const done = props.done?.() ?? false;
    untracked(() => {
      if (text.length < fed) {
        // Another reply: read from its start.
        splitter = new ReplySplitter();
        fed = 0;
        ended = false;
        batch(() => {
          finished.set([]);
          growing.set(NOTHING);
        });
      }
      if (text.length > fed) {
        let piece = text.slice(fed);
        if (cut(piece) && !done) piece = piece.slice(0, -1);
        fed += piece.length;
        take(splitter.push(piece));
      }
      if (done && !ended) {
        ended = true;
        take(splitter.end());
      }
    });
  });

  return (
    <Measured
      align={props.align}
      image={props.image}
      mark={props.mark}
      onLink={props.onLink}
      override={props.override}
      testID={props.testID}
    >
      <Each key={(block: Finished) => block.key} of={finished()}>
        {(block) => <Blocks after={block().key > 0} read={block().read} />}
      </Each>
      <If when={growing().text !== ""}>
        <View style={{ marginTop: finished().length === 0 ? 0 : BLOCK_GAP }}>
          {growing().code ? (
            <Code code={growing().text} growing language={growing().language} />
          ) : (
            <Text style={[prose(), { maxWidth: measure() }]}>{growing().text.trimEnd()}</Text>
          )}
        </View>
      </If>
    </Measured>
  );
}
