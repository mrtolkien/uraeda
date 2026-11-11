// Every icon the app carries, each with its name: Lucide's, then the harnesses' marks.
import { View } from "nsh";
import { Page, Part } from "../parts";
import { Icon, type IconName, Text } from "../../ui/controls";
import { LUCIDE } from "../../ui/controls/icons/lucide";
import { tokens } from "../../ui/tokens";

const NAMES = [...Object.keys(LUCIDE), "claude", "openai", "pi"] as Array<IconName>;

export function icons(narrow: boolean) {
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="Icons" wide>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {NAMES.map((name) => (
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                gap: 6,
                width: narrow ? 170 : 200,
              }}
            >
              <Icon colour={tokens.role.ink} name={name} />
              <Text lines={1} size="under" tone="quiet">
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Part>
    </Page>
  );
}
