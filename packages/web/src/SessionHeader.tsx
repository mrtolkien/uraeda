// A session's header: its title, its status, its agent, and its place.
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { SessionStatus as Status } from "uraeda-server/fate";
import { useAgent } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { StatusMark } from "./StatusMark.tsx";
import type { ChatControls } from "./useSessionControls.ts";

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
 * A session's header: its title, then its status, agent, and place on one line. A chat's
 * title is renamed in place.
 */
export function SessionHeader({
  chat,
  place,
  status,
  title,
}: {
  chat?: ChatControls;
  place?: string;
  status?: { label: string; status: Status };
  title: string;
}) {
  const agent = useAgent();
  const meta = [agent?.name, place].filter((part): part is string => Boolean(part));
  return (
    <VStack gap={1}>
      <Heading level={1}>
        {chat ? (
          <EditableLine field={chat.field} label="Title" onSave={chat.onRename} value={title} />
        ) : (
          title
        )}
      </Heading>
      <HStack align="center" gap={2} wrap="wrap">
        {status && <SessionStatus label={status.label} status={status.status} />}
        <Text color="secondary" type="supporting">
          {meta.join(" · ")}
        </Text>
      </HStack>
    </VStack>
  );
}
