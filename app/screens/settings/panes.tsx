// The settings' panes: a category, the page's subject, in the main stack, and the index of the
// categories with the search across every setting, in the side one. `/settings` alone shows the
// index in the main stack, as a phone's first screen does; `/settings/<category>` shows the
// category, the index beside it, or a tile away on a phone.
import { View } from "nsh";
import { Appearance } from "./Appearance";
import { categoryOf } from "./categories";
import { Extensions } from "./Extensions";
import { Fonts } from "./Fonts";
import { Index } from "./SettingsIndex";
import { Keyboard } from "./Keyboard";
import { Runs } from "./Runs";
import { Server } from "./Server";
import { SignIn } from "./SignIn";
import { navigate } from "../../store";
import { definePane, definePlace, PaneScroll } from "../../ui/layout";
import { Empty } from "../../ui/lists";

export const settingsIndex = definePane({
  icon: "settings",
  kind: "settings-index",
  stack: "side",
  title: "Settings",
  view: () => (
    <PaneScroll style={{ flex: 1 }}>
      <Index />
    </PaneScroll>
  ),
});

/** A category's rows, by its id. */
function Category(props: { id: string }) {
  switch (props.id) {
    case "appearance":
      return <Appearance />;
    case "fonts":
      return <Fonts />;
    case "keyboard":
      return <Keyboard />;
    case "runs":
      return <Runs />;
    case "extensions":
      return <Extensions />;
    case "sign-in":
      return <SignIn />;
    case "server":
      return <Server />;
    default:
      return (
        <Empty
          action={{ label: "Every category", run: () => navigate({ page: "settings" }) }}
          icon="settings"
          title={`No settings named “${props.id}”`}
          words="The address names a category the settings do not have."
        />
      );
  }
}

export const settingsCategory = definePane<{ category: string }>({
  icon: "settings",
  kind: "settings-category",
  stack: "main",
  title: (args) => categoryOf(args.category)?.label ?? "Settings",
  view: (props) => (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ maxWidth: 960 }}>
        <Category id={props.args.category} />
      </View>
    </PaneScroll>
  ),
});

definePlace("settings", (route) =>
  route.category === undefined
    ? [{ pane: settingsIndex({}), stack: "main" }]
    : [settingsCategory({ category: route.category }), settingsIndex({})],
);
