// Where a page is: the places above it, each a link back, then the page, in the ink, separated by
// the terminal's `»`. On a narrow window the places before the last two fold into "…".
import { View } from "nsh";
import { Link } from "./Link";
import { Text } from "./Text";
import { isNarrow } from "../width";

export type Crumb = { label: string; onPress?: () => void };

export type BreadcrumbsProps = { crumbs: ReadonlyArray<Crumb>; testID?: string };

export function Breadcrumbs(props: BreadcrumbsProps) {
  const shown = () => {
    const all = props.crumbs;
    return isNarrow() && all.length > 3
      ? [{ label: "…", onPress: all[all.length - 3]?.onPress }, ...all.slice(-2)]
      : [...all];
  };
  return (
    <View
      role="navigation"
      style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}
      testID={props.testID}
    >
      <Each key="index" of={shown()}>
        {(crumb, at) => (
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <If when={at() > 0}>
              <Text tone="faint">»</Text>
            </If>
            <If
              when={at() < shown().length - 1 && crumb().onPress !== undefined}
              else={
                <Text
                  bold={at() === shown().length - 1}
                  tone={at() === shown().length - 1 ? "ink" : "quiet"}
                >
                  {crumb().label}
                </Text>
              }
            >
              <Link onPress={crumb().onPress}>{crumb().label}</Link>
            </If>
          </View>
        )}
      </Each>
    </View>
  );
}
