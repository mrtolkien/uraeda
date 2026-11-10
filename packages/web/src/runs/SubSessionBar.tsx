// A sub-session's page ends with this bar in place of the composer (spec of Run options): a
// sub-session is read-only to the human, who reads its transcript, stops it while it works, and goes
// back to the session that started it. The bar says what it is: its role, what it works on, its
// agent, model, effort, and state, along a line in the sub-agents' colour.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Suspense, useState } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "../errors.ts";
import { HarnessMark } from "../HarnessMark.tsx";
import { sessionIdPath, useRepoPath } from "../routes.tsx";
import { useSession } from "../sessionData.ts";
import { SessionView } from "../views.ts";
import { SubSessionMark } from "./SubSessionRow.tsx";
import { roleName, runsOnText, STATE_NAMES, type SubSession, usageText } from "./subSessions.ts";

const styles = stylex.create({
  bar: {
    borderBlockStartColor: "var(--role-sub-agent)",
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    paddingBlock: spacingVars["--spacing-3"],
  },
});

/** Stop on the sub-session `id`, and the refusal it met, if any. */
function useStop(id: string) {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const stop = () => {
    setError(undefined);
    void fate.mutations.session
      .stop({ input: { session: id }, view: SessionView })
      .then((result) => {
        if (result.error) {
          setError(refusal(result.error).message);
        }
      });
  };
  return { error, stop };
}

/**
 * The bar of the sub-session `sub`, started by the session titled `parentTitle`: the way back to it,
 * what the sub-session is, and Stop while it works.
 */
function Bar({ parentTitle, sub }: { parentTitle: string; sub: SubSession }) {
  const here = useRepoPath();
  const { error, stop } = useStop(sub.id);
  const usage = usageText(sub);
  return (
    <VStack gap={2} xstyle={styles.bar}>
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Link href={here(sessionIdPath(sub.parent))}>{`↑ ${parentTitle}`}</Link>
        {sub.state === "working" && (
          <Button label="Stop" onClick={stop} size="sm" variant="secondary" />
        )}
      </HStack>
      <HStack align="center" gap={2} wrap="wrap">
        <SubSessionMark state={sub.state} />
        <Text weight="bold">{`${roleName(sub.role)} · ${sub.about}`}</Text>
      </HStack>
      <HStack align="center" gap={2} wrap="wrap">
        <HarnessMark kind={sub.agent} size="sm" />
        <Text color="secondary" type="supporting">
          {[runsOnText(sub), STATE_NAMES[sub.state], usage].filter(Boolean).join(" · ")}
        </Text>
      </HStack>
      {error && (
        <Text color="error" type="supporting">
          {error}
        </Text>
      )}
    </VStack>
  );
}

/** The bar of the sub-session `id`, as its parent `parent`'s record lists it, under its title. */
function ParentBar({ id, parent }: { id: string; parent: string }) {
  const record = useSession(parent);
  const sub = record?.subSessions.find((each) => each.id === id);
  if (!record || !sub) {
    return null;
  }
  return <Bar parentTitle={record.name ?? record.title} sub={sub} />;
}

/**
 * The bar of the sub-session `id`, started by the session `parent`: nothing until the parent is
 * read.
 */
export function SubSessionBar({ id, parent }: { id: string; parent: string }) {
  return (
    <Suspense fallback={null}>
      <ParentBar id={id} parent={parent} />
    </Suspense>
  );
}
