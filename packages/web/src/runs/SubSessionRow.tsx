// A sub-session's card (spec of Run options), the same in the session's Sub-agents pane and under
// its parent in the feature's sessions (`AgentCard`): on its head, its state's mark, what it works
// on, and how long it ran, counted on while it works, then its role and its agent's mark, model,
// and effort; under the rule, its state in a word, when it started and when it ended, or that it
// runs, and its tokens in and out once its agent reported them.
// The card is a link to the sub-session's page, so a click and Enter both open it.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { HarnessMark } from "../HarnessMark.tsx";
import { sessionIdPath, useRepoPath } from "../routes.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { useNow } from "../useNow.ts";
import {
  AgentCard,
  AgentCards,
  type Ending,
  Fact,
  lasted,
  Times,
  timesText,
  Unit,
  Value,
} from "./AgentCard.tsx";
import {
  roleName,
  runsOnText,
  STATE_NAMES,
  type SubSession,
  tokens,
  usageText,
} from "./subSessions.ts";

/** The colour of a state's word. */
const tones = stylex.create({
  done: { color: colorVars["--color-text-secondary"] },
  failed: { color: colorVars["--color-error"] },
  stopped: { color: colorVars["--color-text-secondary"] },
  working: { color: "var(--role-sub-agent)" },
});

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

/** Its role, then its agent's mark with its model and effort, under the title. */
function RunsOn({ sub }: { sub: SubSession }) {
  return (
    <>
      <Fact icon={sub.role === "implementer" ? "uraeda:users" : "uraeda:eye"}>
        <Unit>{roleName(sub.role)}</Unit>
      </Fact>
      <Fact mark={<HarnessMark color="secondary" isDecorative kind={sub.agent} size="xsm" />}>
        <Unit>{runsOnText(sub)}</Unit>
      </Fact>
    </>
  );
}

/** Its tokens, in then out, once its agent reported them: the two counts stay on one line. */
function Usage({ usage }: { usage: NonNullable<SubSession["usage"]> }) {
  return (
    <Fact icon="uraeda:arrow-right-left" isSpaced>
      <Fact>
        <Value>{tokens(usage.input)}</Value>
        <Unit>in</Unit>
      </Fact>
      <Fact>
        <Value>{tokens(usage.output)}</Value>
        <Unit>out</Unit>
      </Fact>
    </Fact>
  );
}

/** When `sub` ended: at its latest turn's end, still running, or unknown, stopped before a turn. */
function endingOf(sub: SubSession): Ending {
  if (sub.state === "working") {
    return "running";
  }
  return sub.endedAt === null ? "unknown" : { at: Date.parse(sub.endedAt) };
}

/** The card of `sub`, a link to its page. */
export function SubSessionRow({ sub }: { sub: SubSession }) {
  const here = useRepoPath();
  const isWorking = sub.state === "working";
  const now = useNow(isWorking ? 1000 : null);
  const ending = endingOf(sub);
  const duration = lasted(sub.startedAt, ending, now);
  return (
    <AgentCard
      duration={duration}
      href={here(sessionIdPath(sub.id))}
      isWorking={isWorking}
      line={<RunsOn sub={sub} />}
      mark={<SubSessionMark state={sub.state} />}
      name={[
        STATE_NAMES[sub.state],
        roleName(sub.role),
        sub.about,
        runsOnText(sub),
        timesText(sub.startedAt, ending, now),
        duration && (isWorking ? `for ${duration}` : `after ${duration}`),
        usageText(sub),
      ]
        .filter(Boolean)
        .join(", ")}
      rowKey={sub.id}
      title={sub.about}
    >
      <Text type="supporting" weight="bold" xstyle={tones[sub.state]}>
        {STATE_NAMES[sub.state]}
      </Text>
      <Times ending={ending} now={now} startedAt={sub.startedAt} />
      {sub.usage && <Usage usage={sub.usage} />}
    </AgentCard>
  );
}

/** The cards of the sub-sessions `subs`, in their order, each a link to its page. */
export function SubSessionCards({ subs }: { subs: ReadonlyArray<SubSession> }) {
  return (
    <AgentCards label="Sub-sessions" order={subs.map((sub) => sub.id)}>
      {subs.map((sub) => (
        <SubSessionRow key={sub.id} sub={sub} />
      ))}
    </AgentCards>
  );
}
