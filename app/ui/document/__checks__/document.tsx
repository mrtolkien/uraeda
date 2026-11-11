// What `document.test.tsx` opens: the check its host names, each saying on the page what a test
// reads. `diagrams` draws a document with a diagram Merman draws and one it cannot read;
// `reply` grows a reply by the pieces its host sends, and counts the blocks made.
import { host, mount, signal, Text, View } from "nsh";
import { markdownTree } from "uraeda/native";
import type { Document as Tree } from "../../../store/protocol";
import { Document, Reply } from "..";

const DIAGRAMS = `Two diagrams:

\`\`\`mermaid
flowchart LR
  A[Proposal] --> B{Questions?}
  B -- Yes --> C[Round]
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Proposal --> ((
\`\`\`
`;

function Diagrams() {
  const tree = JSON.parse(markdownTree(DIAGRAMS)) as Tree;
  return (
    <View style={{ padding: 16 }}>
      <Document document={tree} />
    </View>
  );
}

const REPLY = `I read the plan, and here is what changes.

## The splitter

It reads each piece **once**, and keeps only the block being written.

- A paragraph ends at a blank line.
- A list goes on across blank lines.

  - Even nested.

| Kind | Ends at |
| ---- | ------- |
| Code | its fence |

\`\`\`rust
fn main() {

    println!("a blank line inside");
}
\`\`\`

And the last one, still growing.`;

/** Pieces of 7 characters, as a stream sends them. */
const PIECES = Array.from({ length: Math.ceil(REPLY.length / 7) }, (_, at) =>
  REPLY.slice(at * 7, at * 7 + 7),
);

function Growing() {
  const text = signal("");
  const done = signal(false);
  const made = signal(0);
  let next = 0;
  host.on("append", () => {
    text.update((so) => so + (PIECES[next] ?? ""));
    next += 1;
  });
  host.on("end", () => done.set(true));
  return (
    <View style={{ gap: 8, padding: 16 }}>
      <Text>Pieces: {String(PIECES.length)}</Text>
      <Text>Made: {String(made())}</Text>
      <Text>Blocks: 7</Text>
      <Reply
        done={done}
        mark={(block) => {
          // The reply's own blocks: a list's items have marks of their own.
          if (block.parent === null) made.update((count) => count + 1);
          return undefined;
        }}
        text={text}
      />
    </View>
  );
}

mount(() => (host.params.check === "reply" ? <Growing /> : <Diagrams />));
