// What the shell puts in the status line: the editing mode at its left end, the branch of the
// repository shown, what waits on the human, the extensions' items, the connection's state, and
// the repository at its right end. The hints of the keys between them are the line's own.
import { View } from "nsh";
import { statusItemsOf } from "../../extensions/contributions";
import { ExtensionPlace } from "../../extensions/ExtensionPlace";
import { connection, extensionHost, record } from "../../store";
import type { ExtensionRow } from "../../store/protocol";
import { Icon, Text } from "../../ui/controls";
import type { StatusSlots } from "../../ui/layout";
import { modeTone, vimStatus } from "../../ui/text";
import { tokens } from "../../ui/tokens";

/** The connection in a word: "live", or what it waits for. */
function connectionWords() {
  const now = connection();
  if (now === undefined) return "offline";
  if (now.stale()) return "server stopped";
  return now.status() === "live" ? "live" : now.status();
}

function Connection() {
  return (
    <Text
      colour={connectionWords() === "live" ? undefined : tokens.control.tone("caution")}
      tone="quiet"
    >
      {connectionWords()}
    </Text>
  );
}

/** How many things wait on the human, in every repository. */
const waiting = () => record("NeedsYouList", null)()?.rows.length ?? 0;

/** What waits on the human, in every repository. */
function NeedsYou() {
  return (
    <If when={waiting() > 0}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Icon colour={tokens.light.needs} name="circle-dot" />
        <Text colour={tokens.light.needs}>{`${waiting()} need you`}</Text>
      </View>
    </If>
  );
}

/** An item of an extension's in the status line, drawn by its page. */
function ExtensionItem(props: { extension: ExtensionRow; id: string; repo: string }) {
  return (
    <View style={{ height: tokens.status.height, width: 160 }}>
      <ExtensionPlace
        extension={() => props.extension}
        host={extensionHost()}
        part={{ id: props.id, kind: "statusItem" }}
        repo={props.repo}
      />
    </View>
  );
}

/** After the hints: what waits on the human, the extensions' items, and the connection. */
export function StatusEnd(props: { repo?: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
      <NeedsYou />
      <If when={props.repo}>
        {(shown) => (
          <Each
            key={(one: { item: { id: string }; row: ExtensionRow }) =>
              `${one.row.name}:${one.item.id}`
            }
            of={statusItemsOf(shown())}
          >
            {(one) => <ExtensionItem extension={one().row} id={one().item.id} repo={shown()} />}
          </Each>
        )}
      </If>
      <Connection />
    </View>
  );
}

/** After the mode: the branch the repository shown has checked out. */
export function Branch(props: { repo?: string }) {
  const branch = () =>
    props.repo === undefined
      ? undefined
      : record("Workspace", { repo: props.repo })()?.currentBranch;
  return (
    <If when={branch()}>
      {(name) => (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Icon colour={tokens.role.inkQuiet} name="git-branch" />
          <Text lines={1} tone="quiet">
            {name()}
          </Text>
        </View>
      )}
    </If>
  );
}

/** The editing mode, from the field with the focus: none outside a field, which is "NAV". */
export function modeSlot(): StatusSlots["mode"] {
  const mode = vimStatus().mode;
  return mode === "" ? undefined : { colour: modeTone(mode), label: mode };
}
