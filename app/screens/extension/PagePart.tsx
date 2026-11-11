// A part of an owner's extension's page in a pane: a place, a pane of Home, or a section of the
// New page. The page draws itself in its own view (`ExtensionPlace`), which names its own problems;
// above it, what the server or the app knows is wrong: the extension broke on the server, its keys
// clash with another's, or it no longer declares the part. Where the extension is gone, or has no
// page, the pane says so, with the way to Settings, Extensions.
import { View } from "nsh";
import { keyProblem } from "./keys";
import { declaredBy } from "../../extensions/declared";
import { ExtensionPlace } from "../../extensions/ExtensionPlace";
import type { Declarations, PartKind } from "../../extensions/page";
import { extensionHost, navigate, record } from "../../store";
import type { ExtensionRow } from "../../store/protocol";
import { Banner, Button } from "../../ui/controls";
import { Empty } from "../../ui/lists";

/** The list of the kind's parts in what a page declares. */
const LISTS: Partial<Record<PartKind, keyof Declarations>> = {
  homePane: "homePanes",
  newSection: "newSections",
  place: "places",
};

/** The way to the extensions' settings, where the owner turns one on, and reads its problems. */
const toSettings = {
  icon: "settings" as const,
  label: "Settings, Extensions",
  run: () => navigate({ category: "extensions", page: "settings" }),
};

/** Whether the page, as last declared, has no such part: unknown until it ran once. */
function lacks(row: ExtensionRow, kind: PartKind, id: string) {
  const declared = declaredBy(row.name, row.pageVersion);
  const list = LISTS[kind];
  if (declared === undefined || list === undefined) return false;
  return !(declared[list] as ReadonlyArray<{ id: string }>).some((one) => one.id === id);
}

/** What the server says is wrong with the extension, above its part. */
function Problems(props: { row: ExtensionRow }) {
  const problems = () => (props.row.state === "broken" ? props.row.problems : []);
  return (
    <>
      <Each of={problems()}>
        {(problem) => (
          <Banner
            action={<Button label="Settings" onPress={toSettings.run} />}
            title={`${props.row.title} is broken: ${problem().message}`}
            tone="danger"
          />
        )}
      </Each>
      <If when={keyProblem(props.row.name)}>
        {(words) => (
          <Banner title={`${props.row.title}'s keys are off: ${words()}`} tone="caution" />
        )}
      </If>
    </>
  );
}

export function PagePart(props: {
  id: string;
  kind: PartKind;
  name: string;
  props?: () => unknown;
  repo: string;
}) {
  const extensions = record("Extensions", { repo: props.repo });
  const row = () => extensions()?.extensions.find((one) => one.name === props.name);
  const host = extensionHost();
  return (
    <If
      when={extensions() !== undefined}
      else={<Empty icon="plug" title="Reading the extensions" />}
    >
      <If
        when={row()}
        else={
          <Empty
            action={toSettings}
            icon="circle-alert"
            title={`No extension “${props.name}”`}
            words={`No folder of the extensions folder is named ${props.name}: it was removed, or the address was typed by hand.`}
          />
        }
      >
        {(shown) => (
          <If
            when={shown().pageVersion !== null && !lacks(shown(), props.kind, props.id)}
            else={
              <Empty
                action={toSettings}
                icon="circle-alert"
                title={`${shown().title} has no place “${props.id}”`}
                words={
                  shown().pageVersion === null
                    ? `${shown().title} has no page built: its manifest names none, or its page does not compile. Settings, Extensions lists its problems.`
                    : `Its page no longer declares it: a saved page may have renamed it.`
                }
              />
            }
          >
            <View style={{ flex: 1, gap: 8 }}>
              <Problems row={shown()} />
              <ExtensionPlace
                extension={() => shown()}
                host={host}
                part={{ id: props.id, kind: props.kind }}
                props={props.props}
                repo={props.repo}
              />
            </View>
          </If>
        )}
      </If>
    </If>
  );
}
