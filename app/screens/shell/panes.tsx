// The shell's own pane: "Nothing here", for an address the app has no page for, and for a page
// whose screen is not built yet, with the way home. A screen's panes are its own module's
// (`../routes.tsx`).
import { View } from "nsh";
import { navigate, pathOf, route } from "../../store";
import { Button, Heading, Text } from "../../ui/controls";
import { definePane, definePlace } from "../../ui/layout";
import { placeOfPage } from "./places";

export const nothing = definePane<{ path: string; place?: string }>({
  icon: "square-dashed",
  kind: "nothing",
  stack: "main",
  title: "Nothing here",
  view: (props) => (
    <View style={{ gap: 16, maxWidth: 560 }}>
      <View style={{ gap: 6 }}>
        <Heading level={1}>Nothing here</Heading>
        <Text tone="quiet">
          {props.args.place === undefined
            ? `Uraeda has no page at ${props.args.path}.`
            : `This app has no ${props.args.place} screen: nothing draws ${props.args.path}.`}
        </Text>
      </View>
      <View style={{ alignItems: "flex-start" }}>
        <Button icon="house" label="Home" onPress={() => navigate({ page: "home" })} />
      </View>
    </View>
  ),
});

definePlace("missing", (shown) => [nothing({ path: shown.path })]);

/** "Nothing here" for the page shown, whose screen declared no pane. */
export const nothingFor = () =>
  nothing({ path: pathOf(route()), place: placeOfPage(route().page) ?? "such" });
