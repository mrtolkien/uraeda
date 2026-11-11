// What the unfolded rail shows under the places: the repository's features and changes, what needs
// the human in every repository, and the agents' usage, one line per login. A pane shows only when
// it has a row: an empty one would stand there saying nothing. Folded, the rail keeps one bar of
// all this, the usage of the account in view.
import { View } from "nsh";
import { barWindow, LOW, type UsageLine, usageLines } from "./usage";
import { navigate, parseRoute, record, route } from "../../store";
import type { NeedsYouRow, WorkspaceFeature } from "../../store/protocol";
import { Icon, type IconName, Text } from "../../ui/controls";
import { Row } from "../../ui/lists";
import { Pane } from "../../ui/surfaces";
import { tokens } from "../../ui/tokens";

/** A feature's state, as its row's icon and hue. */
function stateOf(feature: WorkspaceFeature): { icon: IconName; hue?: string } {
  switch (feature.status.status) {
    case "working":
      return { hue: tokens.light.running, icon: "activity" };
    case "needs-you":
      return { hue: tokens.light.needs, icon: "circle-dot" };
    case "attention":
      return { hue: tokens.control.tone("caution"), icon: "triangle-alert" };
    default:
      return { icon: feature.kind === "change" ? "git-branch" : "flag" };
  }
}

/**
 * A row's two lines: what it is, and under it, smaller, its state; its icon in the state's hue.
 * The one open now, `current`, has its title in the accent and bold, as a list's current row.
 */
function Two(props: {
  current?: boolean;
  hue?: string;
  icon: IconName;
  title: string;
  under?: string;
}) {
  return (
    <>
      <Icon
        colour={props.hue}
        name={props.icon}
        style={{ alignSelf: "flex-start", marginTop: 4 }}
      />
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 2 }}>
        <Text
          bold={props.current === true}
          colour={props.current === true ? tokens.row.current : undefined}
          lines={1}
        >
          {props.title}
        </Text>
        <If when={props.under}>
          {(under) => (
            <Text colour={props.hue} lines={1} size="under" tone="quiet">
              {under()}
            </Text>
          )}
        </If>
      </View>
    </>
  );
}

/** The feature whose page shows, if any. */
function shownFeature() {
  const now = route();
  return now.page === "feature" || now.page === "session" || now.page === "file"
    ? now.folder
    : undefined;
}

/** What needs the human, in every repository. */
const needing = () => record("NeedsYouList", null)()?.rows ?? [];

function Features(props: { repo: string }) {
  const features = () => record("Workspace", { repo: props.repo })()?.features ?? [];
  return (
    <If when={features().length > 0}>
      <Pane
        body={{ gap: 0, paddingHorizontal: 0 }}
        more={`· ${features().length}`}
        title="Features"
      >
        <Each key={(feature: WorkspaceFeature) => feature.id} of={features()}>
          {(feature) => (
            <Row
              accessibilityLabel={feature().label ?? feature().title}
              onPress={() => navigate({ folder: feature().id, page: "feature" })}
            >
              <Two
                current={shownFeature() === feature().id}
                hue={stateOf(feature()).hue}
                icon={stateOf(feature()).icon}
                title={feature().label ?? feature().title}
                under={feature().status.status === "idle" ? undefined : feature().status.label}
              />
            </Row>
          )}
        </Each>
      </Pane>
    </If>
  );
}

function NeedsYou(props: { repo: string }) {
  return (
    <If when={needing().length > 0}>
      <Pane
        body={{ gap: 0, paddingHorizontal: 0 }}
        more={`· ${needing().length}`}
        needs
        title="Needs you"
      >
        <Each key={(row: NeedsYouRow) => row.id} of={needing()}>
          {(row) => (
            <Row
              accessibilityLabel={`${row().label}: ${row().message}`}
              onPress={() => navigate(parseRoute(row().href))}
            >
              <Two
                hue={tokens.light.needs}
                icon={row().folder === null ? "message-square" : "circle-dot"}
                title={row().label}
                under={
                  row().repository === props.repo
                    ? row().message
                    : `${row().repository} · ${row().message}`
                }
              />
            </Row>
          )}
        </Each>
      </Pane>
    </If>
  );
}

/** What is left, as a bar of the tokens' colours: the accent's, or the danger's once nearly gone. */
function Left(props: { left: number; width: number | `${number}%` }) {
  return (
    <View
      accessibilityLabel={`${props.left}% left`}
      style={{
        backgroundColor: tokens.role.ruleQuiet,
        height: 3,
        overflow: "hidden",
        width: props.width,
      }}
    >
      <View
        style={{
          backgroundColor: props.left <= LOW ? tokens.control.tone("danger") : tokens.role.action,
          height: "100%",
          width: `${props.left}%`,
        }}
      />
    </View>
  );
}

function Usage(props: { repo: string }) {
  const lines = () => usageLines(record("Agent", { repo: props.repo })(), new Date());
  return (
    <If when={lines().length > 0}>
      <Pane body={{ gap: 6, paddingVertical: 6 }} title="Usage">
        <Each key={(line: UsageLine) => line.id} of={lines()}>
          {(line) => (
            <View style={{ gap: 3 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <Text
                  font="code"
                  lines={1}
                  size="under"
                  style={{ flex: 1, minWidth: 0 }}
                  tone="quiet"
                >
                  {line().label}
                </Text>
                <Text
                  font="code"
                  size="under"
                  tone={
                    line().trouble !== undefined || (line().left ?? 100) <= LOW ? "danger" : "quiet"
                  }
                >
                  {line().trouble ??
                    `${line().left}%${line().resets === undefined ? "" : ` · ${line().resets}`}`}
                </Text>
              </View>
              <If when={line().left}>{(left) => <Left left={left()} width="100%" />}</If>
            </View>
          )}
        </Each>
      </Pane>
    </If>
  );
}

/** The sidebar's panes, under the places. */
export function Sidebar(props: { repo: string }) {
  return (
    <>
      <NeedsYou repo={props.repo} />
      <Features repo={props.repo} />
      <Usage repo={props.repo} />
    </>
  );
}

/** The folded rail's bar: what is left of the account of the session in view. */
export function UsageBar(props: { repo: string }) {
  const session = () => {
    const now = route();
    if (now.page !== "session-id") return undefined;
    const shown = record("Session", { id: now.id, repo: props.repo })();
    return shown ? { accountId: shown.accountId, agent: shown.agent } : undefined;
  };
  const window = () => barWindow(record("Agent", { repo: props.repo })(), session());
  return (
    <If when={window()}>
      {(shown) => (
        <View
          accessibilityLabel={`${shown().label}: ${shown().left}% left`}
          style={{ alignItems: "center", gap: 4, marginTop: 8 }}
        >
          <Left left={shown().left} width={24} />
          <Text font="code" size="under" tone="faint">
            {`${shown().left}`}
          </Text>
        </View>
      )}
    </If>
  );
}
