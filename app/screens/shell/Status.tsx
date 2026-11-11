// What the shell puts in the status line: the editing mode at its left end, the branch of the
// repository shown, what waits on the human, the extensions' items, the connection's state, and
// the repository at its right end. The hints of the keys between them are the line's own.
import { View } from "nsh";
import { declaredBy } from "../../extensions/declared";
import { ExtensionPlace, ReadDeclarations } from "../../extensions/ExtensionPlace";
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

/** An extension's items of the status line, once its page said which it has. */
function ExtensionItems(props: { extension: ExtensionRow; repo: string }) {
  const host = extensionHost();
  const items = () =>
    declaredBy(props.extension.name, props.extension.pageVersion)?.statusItems ?? [];
  return (
    <>
      <ReadDeclarations extension={props.extension} host={host} repo={props.repo} />
      <Each key={(item: { id: string }) => item.id} of={items()}>
        {(item) => (
          <View style={{ height: tokens.status.height, width: 160 }}>
            <ExtensionPlace
              extension={() => props.extension}
              host={host}
              part={{ id: item().id, kind: "statusItem" }}
              repo={props.repo}
            />
          </View>
        )}
      </Each>
    </>
  );
}

/** The extensions on in `repo` whose page is built. */
function paged(repo: string): ExtensionRow[] {
  const all = record("Extensions", { repo })()?.extensions ?? [];
  return all.filter(
    (row) => row.pageVersion !== null && row.state === "on" && (row.onAll || row.on.includes(repo)),
  );
}

/** After the hints: what waits on the human, the extensions' items, and the connection. */
export function StatusEnd(props: { repo?: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
      <NeedsYou />
      <If when={props.repo}>
        {(shown) => (
          <Each key={(row: ExtensionRow) => row.name} of={paged(shown())}>
            {(row) => <ExtensionItems extension={row()} repo={shown()} />}
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
