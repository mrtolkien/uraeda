// Every height inside every other, each over the busiest page: a height keeps its own recipe
// wherever it is. A well in a card takes the page's fill, a well in a well or in glass darkens
// what it is cut in, and glass stays glass. Rows are the outer surface, columns the inner one; on
// a narrow window the cells wrap, two a row.
import { View } from "nsh";
import { Busy, gapOf } from "../parts";
import { Text } from "../../ui/controls";
import { Surface } from "../../ui/surfaces";
import { type HeightName, tokens } from "../../ui/tokens";

const NAMES: Array<HeightName> = ["recessed", "standard", "raised", "overlay"];

export function heights(narrow: boolean) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: gapOf(narrow) / 2 }}>
      {NAMES.flatMap((outer) =>
        NAMES.map((inner) => (
          <View
            style={{
              backgroundColor: tokens.role.page,
              borderColor: tokens.role.ruleQuiet,
              borderWidth: 1,
              flexBasis: narrow ? "40%" : "20%",
              flexGrow: 1,
              height: narrow ? 100 : 160,
              overflow: "hidden",
              padding: narrow ? 6 : 12,
            }}
          >
            <Busy times={4} />
            <Surface height={outer} style={{ padding: narrow ? 6 : 12 }}>
              <Text size="under" tone="quiet">
                {outer}
              </Text>
              <Surface
                height={inner}
                style={{ marginTop: 4, paddingHorizontal: narrow ? 6 : 10, paddingVertical: 2 }}
              >
                <Text>{inner}</Text>
              </Surface>
            </Surface>
          </View>
        )),
      )}
    </View>
  );
}
