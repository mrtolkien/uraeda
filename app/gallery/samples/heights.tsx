// Sample 1: every height nested in every other, each over the busiest page. Rows are the outer
// surface, columns the inner one.
import { View } from "nsh";
import { busy, type Height, mono, surface, tag } from "./parts";
import type { Tokens } from "../../ui/tokens";

const NAMES: Height[] = ["recessed", "standard", "raised", "overlay"];

export function heights(v: Tokens) {
  return (
    <View style={{ flex: 1, padding: 24, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ width: 80 }} />
        {NAMES.map((inner) => (
          <View style={{ flex: 1 }}>{tag(v, `${inner} inside`)}</View>
        ))}
      </View>
      {NAMES.map((outer) => (
        <View style={{ flex: 1, flexDirection: "row", gap: 10 }}>
          <View style={{ width: 80, justifyContent: "center" }}>{tag(v, outer)}</View>
          {NAMES.map((inner) => (
            <View
              style={{
                flex: 1,
                padding: 14,
                overflow: "hidden",
                backgroundColor: v.role.page,
                borderWidth: 1,
                borderColor: v.role.ruleQuiet,
              }}
            >
              {busy(v, 4)}
              {surface(
                v,
                outer,
                { style: { padding: 12 } },
                <>
                  {tag(v, outer, { color: v.role.inkQuiet })}
                  {surface(
                    v,
                    inner,
                    { style: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 8 } },
                    mono(v, inner),
                  )}
                </>,
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
