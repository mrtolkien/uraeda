// Every height inside every other, each over the busiest page: a height keeps its own recipe
// wherever it is. A well in a card takes the page's fill, a well in a well or in glass darkens
// what it is cut in, and glass stays glass. Rows are the outer surface, columns the inner one; on
// a narrow window the cells wrap, two a row.
import { View } from "nsh";
import { busy, mono, tag } from "../samples/parts";
import { Surface } from "../../ui/surfaces";
import type { HeightName, Tokens } from "../../ui/tokens";

const NAMES: Array<HeightName> = ["recessed", "standard", "raised", "overlay"];

export function heights(v: Tokens, narrow: boolean) {
  const gap = narrow ? 6 : 10;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        gap,
        padding: narrow ? 8 : 24,
      }}
    >
      {NAMES.flatMap((outer) =>
        NAMES.map((inner) => (
          <View
            style={{
              backgroundColor: v.role.page,
              borderColor: v.role.ruleQuiet,
              borderWidth: 1,
              flexBasis: narrow ? "40%" : "20%",
              flexGrow: 1,
              height: narrow ? 92 : 178,
              overflow: "hidden",
              padding: narrow ? 6 : 14,
            }}
          >
            {busy(v, 4)}
            <Surface height={outer} style={{ padding: narrow ? 6 : 12 }}>
              {tag(v, outer, { color: v.role.inkQuiet })}
              <Surface
                height={inner}
                style={{
                  marginTop: narrow ? 3 : 8,
                  paddingHorizontal: narrow ? 6 : 10,
                  paddingVertical: narrow ? 2 : 8,
                }}
              >
                {mono(v, inner)}
              </Surface>
            </Surface>
          </View>
        )),
      )}
    </View>
  );
}
