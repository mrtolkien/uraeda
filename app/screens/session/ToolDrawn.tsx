// A tool's item drawn by an extension's page, its `itemRenderer` for the tool's name, in place of
// the item's line: the page's view, 160 points high, given `{ item }`, which it reads with
// `useProps` and gets again as the item changes. A page that breaks says so in its place, and the
// transcript goes on.
import { View } from "nsh";
import { rendererOf } from "../../extensions/contributions";
import { ExtensionPlace } from "../../extensions/ExtensionPlace";
import { extensionHost } from "../../store";
import type { Item } from "../../store/protocol";

type Tool = Extract<Item, { kind: "tool" }>;

export function ToolDrawn(props: { item: () => Tool | undefined; repo: string }) {
  const renderer = () => {
    const tool = props.item();
    return tool === undefined ? undefined : rendererOf(props.repo, tool.name);
  };
  return (
    <If when={renderer()}>
      {(found) => (
        <View style={{ height: 160 }}>
          <ExtensionPlace
            extension={() => found().row}
            host={extensionHost()}
            part={{ id: found().tool, kind: "itemRenderer" }}
            props={() => ({ item: props.item() })}
            repo={props.repo}
          />
        </View>
      )}
    </If>
  );
}
