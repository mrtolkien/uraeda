// A session's header: its title, its status, its agent's mark and name, and its place.

import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";

import type { SessionStatus as Status } from "uraeda-server/fate";
import { useAgent } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { HarnessMark, harnessMark } from "./HarnessMark.tsx";
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
 * A session's header: its title, then its status, agent, and place on one line. Its title
 * is renamed in place, once the session exists. The agent is the one the session runs on, by its
 * kind, as its card in the navigation names it; before the session exists, the one it will start.
 */
export function SessionHeader({
  agent: kind,
  place,
  rename,
  status,
  title,
}: {
  /** The kind of agent the session runs on. */
  agent?: string;
  place?: string;
  rename?: RenameControls;
  status?: { label: string; status: Status };
  title: string;
}) {
  const configured = useAgent();
  const agent = kind === undefined ? configured : { kind, name: harnessMark(kind).name };
  const meta = [agent?.name, place].filter((part): part is string => Boolean(part));
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
