// A code block: in a well, as typed text, in the code font on the interface's line, scrolling
// sideways inside itself, never the page. Its colours are the theme's `syntax-*` roles, read in
// Rust once the block is finished (`highlightCode`): plain until they come, and never again. Its
// language and a copy button sit on its first line, out of the code's way.
import { Clipboard, Scroll, signal, Text, View } from "nsh";
import { type CodeRun, highlightCode } from "uraeda/native";
import { IconButton } from "../controls";
import { Well } from "../surfaces";
import { tokens } from "../tokens";
import { DocumentContext } from "./context";
import { code as codeStyle, measure } from "./look";

/** A run's colour: its role's, or the code's own. */
function colourOf(role: string): string {
  if (role === "") return tokens.role.ink;
  const name = `syntax${role[0]!.toUpperCase()}${role.slice(1)}` as keyof typeof tokens.role;
  return tokens.role[name] ?? tokens.role.ink;
}

/** The code, as one text of runs: `growing` while a reply still writes it, so never coloured. */
export function Code(props: { code: string; growing?: boolean; language: string }) {
  // A block's last line break ends its last line: it draws no empty line under it.
  const text = props.code.replace(/\n$/, "");
  const hands = DocumentContext();
  const runs = signal<ReadonlyArray<CodeRun>>([{ role: "", text }]);
  const copied = signal(false);
  if (props.growing !== true && props.language !== "") {
    highlightCode(text, props.language).then(
      (coloured) => runs.set(coloured),
      // Code it cannot colour stays plain.
      () => undefined,
    );
  }
  return (
    // As wide as its longest line, from the prose's measure to the document's right edge.
    <Well
      style={{
        alignSelf: "flex-start",
        maxWidth: "100%",
        minWidth: Math.min(measure(), Math.max(0, hands.width() - hands.inset())),
        paddingVertical: 10,
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingHorizontal: 14 }}>
        <Text
          style={{
            color: tokens.role.inkFaint,
            flexGrow: 1,
            fontFamily: tokens.type.body,
            fontSize: tokens.type.under,
            lineHeight: tokens.type.line,
          }}
        >
          {props.language}
        </Text>
        {props.growing === true ? null : (
          <IconButton
            icon={copied() ? "check" : "copy"}
            label={copied() ? "Copied" : "Copy the code"}
            onPress={() => {
              void Clipboard.writeText(text).then(() => copied.set(true));
            }}
          />
        )}
      </View>
      <Scroll horizontal style={{ flexGrow: 0 }}>
        <View style={{ paddingHorizontal: 14 }}>
          <Text style={codeStyle()} testID="code">
            {runs().map((run) => (
              <Text style={{ color: colourOf(run.role) }}>{run.text}</Text>
            ))}
          </Text>
        </View>
      </Scroll>
    </Well>
  );
}
