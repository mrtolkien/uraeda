// A session's header: its title, its status, its agent's mark and name, its account, and its place.
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import type { SessionStatus as Status } from "uraeda-server/fate";
import { EditableLine } from "./EditableLine.tsx";
import { HarnessMark, useHarnessMark } from "./HarnessMark.tsx";
import { useRuntimesOn } from "./runtimes.ts";
import { StatusMark } from "./StatusMark.tsx";
import type { RenameControls } from "./useSessionControls.ts";
import { PageTitle } from "./layout/PageTitle.tsx";

/** A session's status: its dot, and its label. */
export function SessionStatus({ label, status }: { label: string; status: Status }) {
  return (
    <HStack align="center" gap={2}>
      <StatusMark label={label} status={status} />
      <Text weight="semibold">{label}</Text>
    </HStack>
  );
}

/**
 * A session's header: its title, then its status, agent, account, model and effort, and place on one line. Its title
 * is renamed in place, once the session exists. The agent is the one the session runs on, by its
 * kind, as its card in the navigation names it; before the session exists, the one it will start,
 * while only one is on: with more, the composer's picker says which.
 */
export function SessionHeader({
  account,
  agent: kind,
  place,
  rename,
  runsOn,
  status,
  title,
}: {
  /** The account the session runs on, by its name: none for a session with none. */
  account?: string | null | undefined;
  /** The kind of agent the session runs on. */
  agent?: string;
  place?: string;
  rename?: RenameControls;
  /** The model and the effort that ran, as the agent reported them: "GPT-6.1-Sol · High". */
  runsOn?: string;
  status?: { label: string; status: Status };
  title: string;
}) {
  const on = useRuntimesOn();
  const shown = kind ?? (on.length === 1 ? on[0]!.kind : undefined);
  const { name } = useHarnessMark(shown ?? "");
  const agent = shown === undefined ? undefined : { kind: shown, name };
  const meta = [agent?.name, account, runsOn, place].filter((part): part is string =>
    Boolean(part),
  );
  return (
    <PageTitle
      meta={{
        marks: (
          <>
            {status && <SessionStatus label={status.label} status={status.status} />}
            {agent && <HarnessMark isDecorative kind={agent.kind} />}
          </>
        ),
        text: meta.join(" · "),
      }}
    >
      {rename ? (
        <EditableLine field={rename.field} label="Title" onSave={rename.onRename} value={title} />
      ) : (
        title
      )}
    </PageTitle>
  );
}
