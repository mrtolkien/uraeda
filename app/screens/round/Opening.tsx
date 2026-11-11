// A round's opening, before its first question: what the agent concluded, the round's context,
// and the points it settled that the human should check, each open to a comment. Drawn whole by
// the document renderer, in the file's own order.
import { View } from "nsh";
import type { FileView, RoundItems } from "../../store/protocol";
import { Heading, Text } from "../../ui/controls";
import { Document, type DocumentHands } from "../../ui/document";
import { titleOf } from "../file/read";
import { plain } from "../file/read";
import type { RoundArgs, Saves } from "./saves";
import { settledMark } from "./Settled";
import { questions } from "./words";
import { askedOf } from "./position";

export function Opening(props: {
  args: RoundArgs;
  file: () => FileView;
  links: DocumentHands;
  round: () => RoundItems;
  saves: Saves;
}) {
  const document = () => props.file().current.document;
  const ids = () => {
    const round = props.round();
    const check = round.settledGroups.filter((group) => group.kind === "check");
    const shown: Array<number> = round.block === null ? [] : [round.block];
    for (const part of round.context) {
      if (part.heading !== null) shown.push(part.heading);
      shown.push(...part.blocks);
    }
    for (const group of check) shown.push(group.heading, ...group.blocks);
    return shown;
  };
  const title = () => {
    const heading = titleOf(document().blocks);
    return heading === undefined ? props.file().name : plain(heading.spans);
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Heading level={1}>{title()}</Heading>
        <Text tone="quiet">
          {`${questions(askedOf(props.round()).length)} after this. Each answer saves as you make it; nothing goes to the agent before you submit, at the end.`}
        </Text>
      </View>
      <Document
        align="start"
        document={document()}
        ids={ids()}
        image={props.links.image}
        mark={settledMark({
          args: props.args,
          file: props.file,
          round: props.round,
          saves: props.saves,
        })}
        onLink={props.links.onLink}
        override={props.links.override}
      />
    </View>
  );
}
