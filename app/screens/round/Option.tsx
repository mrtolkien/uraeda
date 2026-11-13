// An option of a question, as a card the human picks: its letter, whether it is the one
// recommended, its sentence, then its pros and cons, why it is recommended, and what else it holds,
// a prototype's picture included. Everything needed to weigh it is on the card, in the reading
// font: the human never opens the file to decide.
import { View } from "nsh";
import type { Block, Choice, Document as Tree, Span } from "../../store/protocol";
import { Text } from "../../ui/controls";
import { Document, type DocumentHands, Phrase } from "../../ui/document";
import { SelectableCard } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { lead } from "./words";

/** A pro's or a con's words, without the `[pro]` or `[con]` it starts with. */
function pointWords(block: Block | undefined): ReadonlyArray<Span> {
  const spans = block?.spans ?? [];
  const [first, ...rest] = spans;
  if (first === undefined) return spans;
  const text = first.text.replace(/^\s*\[(pro|con)\]\s*/i, "");
  return text === "" ? rest : [{ ...first, text }, ...rest];
}

/** "Why recommended:" is the card's own words: the item's after it. */
function why(block: Block | undefined): ReadonlyArray<Span> {
  const spans = block?.spans ?? [];
  const [first, ...rest] = spans;
  if (first === undefined) return spans;
  const text = first.text.replace(/^\s*why recommended\s*[:.—-]?\s*/i, "");
  return text === "" ? rest : [{ ...first, text }, ...rest];
}

/** One pro or con: its sign in its tone, then its words. */
function Point(props: { block: Block | undefined; sign: "+" | "−" }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Text bold tone={props.sign === "+" ? "done" : "caution"}>
        {props.sign}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Phrase spans={pointWords(props.block)} />
      </View>
    </View>
  );
}

export type OptionProps = {
  choice: Choice;
  document: Tree;
  /** How the document's links and images go: the reader's own. */
  hands: DocumentHands;
  onPick: () => void;
  picked: boolean;
  disabled?: boolean;
};

export function Option(props: OptionProps) {
  const block = (id: number) => props.document.blocks[id];
  const title = () => `${props.choice.letter}${props.choice.recommended ? " · Recommended" : ""}`;
  return (
    <SelectableCard
      disabled={props.disabled}
      icon={props.choice.recommended ? "lightbulb" : undefined}
      hue={props.choice.recommended ? tokens.role.action : undefined}
      onSelect={props.onPick}
      selected={props.picked}
      testID={`option-${props.choice.letter}`}
      title={title()}
    >
      <View style={{ gap: 6, paddingTop: 2 }}>
        <Phrase bold spans={props.choice.summary} />
        <Each of={props.choice.pros}>{(id) => <Point block={block(id())} sign="+" />}</Each>
        <Each of={props.choice.cons}>{(id) => <Point block={block(id())} sign="−" />}</Each>
        <If when={props.choice.why}>
          {(id) => (
            <Phrase
              colour={tokens.role.inkQuiet}
              spans={[lead("Why recommended: "), ...why(block(id()))]}
            />
          )}
        </If>
        <If when={props.choice.other.length > 0}>
          <Document
            align="start"
            document={props.document}
            ids={props.choice.other}
            image={props.hands.image}
            onLink={props.hands.onLink}
            override={props.hands.override}
          />
        </If>
      </View>
    </SelectableCard>
  );
}
