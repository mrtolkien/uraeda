// A sub-session's row (spec of Run options), the same in the session's Sub-agents pane and under
// its parent in the feature's sessions: its state's mark, what it works on, then its role, its
// agent's mark, its model and effort, and its usage when known, with how long it ran at its end.
// The row is a link to the sub-session's page, so a click and Enter both open it.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { HarnessMark } from "../HarnessMark.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { sessionIdPath, useRepoPath } from "../routes.tsx";
import { CardRow } from "../sidebar/CardRow.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { elapsed } from "../TurnLines.tsx";
import { useNow } from "../useNow.ts";
import { roleName, runsOnText, STATE_NAMES, type SubSession, usageText } from "./subSessions.ts";

/** A sub-session's state as a mark: the sub-agent's working square, ✓, the error's !, or ■. */
export function SubSessionMark({ state }: { state: SubSession["state"] }) {
  const label = STATE_NAMES[state];
  switch (state) {
    case "working":
      return <StatusMark isSubagent label={label} small status="working" />;
    case "failed":
      return <StatusMark label={label} small status="attention" />;
    case "done":
      return <Icon color="secondary" icon="uraeda:badge-check" label={label} size="sm" />;
    default:
      return <Icon color="secondary" icon="uraeda:square" label={label} size="sm" />;
  }
}

/** Its role, agent, model, effort, and usage, on the row's second line. */
function RunsOn({ sub }: { sub: SubSession }) {
  const usage = usageText(sub);
  return (
    <HStack align="center" gap={2} wrap="wrap">
      <HStack align="center" gap={1}>
        <Icon
          color="inherit"
          icon={sub.role === "implementer" ? "uraeda:users" : "uraeda:eye"}
          size="xsm"
        />
        <Text color="secondary" type="supporting">
          {roleName(sub.role)}
        </Text>
      </HStack>
      <HStack align="center" gap={1}>
        <HarnessMark color="secondary" isDecorative kind={sub.agent} size="xsm" />
        <Text color="secondary" type="supporting">
          {runsOnText(sub)}
        </Text>
      </HStack>
      {usage && (
        <Text color="secondary" type="supporting">
          {`· ${usage}`}
        </Text>
      )}
    </HStack>
  );
}

/** The row of `sub`, a link to its page. */
export function SubSessionRow({ sub }: { sub: SubSession }) {
  const here = useRepoPath();
  const now = useNow(sub.endedAt === null ? 1000 : null);
  const end = sub.endedAt === null ? now : Date.parse(sub.endedAt);
  const time = elapsed(Math.max(end - Date.parse(sub.startedAt), 0));
  const usage = usageText(sub);
  return (
    <CardRow
      endContent={
        <Text color="secondary" type="supporting">
          {time}
        </Text>
      }
      href={here(sessionIdPath(sub.id))}
      icon={<SubSessionMark state={sub.state} />}
      isHeaded={isNarrow(useWidthClass())}
      isSelected={false}
      label={sub.about}
      name={[STATE_NAMES[sub.state], roleName(sub.role), sub.about, runsOnText(sub), usage, time]
        .filter(Boolean)
        .join(", ")}
      sub={<RunsOn sub={sub} />}
    />
  );
}
