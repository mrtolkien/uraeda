// A theme drawn in its own colours, to be chosen among others: its page, a raised strip with its
// ink and its quiet ink, and a dot of each of its accents. It is the one component that draws a
// theme's colours rather than the tokens': a list of themes previews each as it would look. The
// one picked has its edge in the accent and a tick, in the tokens' colours, as any choice made.
import { View } from "nsh";
import { Icon, Text } from "../controls";
import { tokens } from "../tokens";

export type ThemeSampleProps = {
  /** Its name, as the lists show it. */
  name: string;
  /** Each role's colour, by the role's name, as the server's `Theme` gives them. */
  roles: { readonly [role: string]: string };
  /** It is the one in use for its mode. */
  picked?: boolean;
  /** Under its name, fainter: "yours". */
  note?: string;
  onPress?: () => void;
  testID?: string;
  width?: number;
};

/** The accents shown as dots, in order. */
const ACCENTS = ["action", "needs-you", "added", "removed", "link", "working"];

export function ThemeSample(props: ThemeSampleProps) {
  const role = (name: string, or: string) => props.roles[name] ?? or;
  const ink = () => role("ink", tokens.role.ink);
  return (
    <View
      accessibilityLabel={props.name}
      accessibilityState={{ selected: props.picked === true }}
      onPress={props.onPress}
      role="button"
      style={{
        backgroundColor: role("page", tokens.role.page),
        borderColor: props.picked === true ? tokens.light.focus : role("rule", tokens.role.rule),
        borderWidth: 1,
        gap: 6,
        padding: 8,
        paddingLeft: 10,
        width: props.width ?? 196,
      }}
      testID={props.testID}
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Text bold colour={ink()} style={{ flex: 1 }}>
          {props.name}
        </Text>
        <If when={props.picked === true}>
          <Icon colour={role("action", ink())} name="check" />
        </If>
      </View>
      <View
        style={{
          backgroundColor: role("raised", role("page", tokens.role.page)),
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 6,
          paddingVertical: 3,
        }}
      >
        <Text colour={ink()} font="code" size="under">
          Aa
        </Text>
        <Text colour={role("ink-quiet", ink())} lines={1} size="under" style={{ flex: 1 }}>
          {props.note ?? "quiet words"}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 5 }}>
        <Each key={(accent: string) => accent} of={ACCENTS}>
          {(accent) => (
            <View style={{ backgroundColor: role(accent(), ink()), height: 10, width: 10 }} />
          )}
        </Each>
      </View>
    </View>
  );
}
