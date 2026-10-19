// The Server category: the host names the server accepts, its port, and whether it opens a browser
// when it starts, each as the settings file holds it, with the value in force when a flag or a
// variable overrides it for this run.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { Settings } from "uraeda-server/fate";
import { EditableLine, LineField } from "../EditableLine.tsx";
import { useLineSave } from "../useLineSave.ts";

/** The settings record, as the page reads it: the file, its problem, and the values. */
export type ServerValues = Pick<Settings, "file" | "problem" | "runs" | "server">;

/** Where a value in force comes from, as the record says. */
type Source = ServerValues["server"]["port"]["source"];

/**
 * What the categories of the settings file change, each through the server: each resolves with
 * the error to show, or with nothing once saved.
 */
export type ServerActions = {
  addHost: (name: string) => Promise<string | undefined>;
  editHost: (from: string, to: string) => Promise<string | undefined>;
  removeHost: (name: string) => Promise<string | undefined>;
  setBuildInFreshSession: (fresh: boolean) => Promise<string | undefined>;
  setOpenBrowser: (open: boolean) => Promise<string | undefined>;
  setPort: (port: string) => Promise<string | undefined>;
};

const EMPTY_HOST = "A host name cannot be empty.";
const EMPTY_PORT = "The port is a number from 1 to 65535.";

/** "Set by --port for this run: 4400.", when a flag or a variable overrides the file. */
function overridden<T>(
  setting: { inForce: T; source: Source },
  show: (value: T) => string,
): string | undefined {
  const { inForce, source } = setting;
  if (source.kind !== "flag" && source.kind !== "environment") {
    return undefined;
  }
  return `Set by ${source.name} for this run: ${show(inForce)}.`;
}

/** The line that adds a host name: a button, then a field that stays open for the next name. */
function AddHost({ onSave }: { onSave: (name: string) => Promise<string | undefined> }) {
  const line = useLineSave({
    empty: EMPTY_HOST,
    field: "settings.host.new",
    onSave,
    stayOpen: true,
    value: "",
  });
  if (line.open) {
    return <LineField label="New host name" line={line} />;
  }
  return (
    <HStack>
      <Button label="＋ Add a host name" onClick={line.openLine} variant="secondary" />
    </HStack>
  );
}

/** The host names, one line each, edited in place, then the line that adds one. */
function Hosts({ actions, values }: { actions: ServerActions; values: ServerValues }) {
  const { allowedHosts } = values.server;
  const hosts = allowedHosts.saved ?? [];
  const note = overridden(allowedHosts, (names) => names.join(", ") || "none");
  const [refused, setRefused] = useState<string>();
  const remove = async (host: string) => {
    setRefused(undefined);
    setRefused(await actions.removeHost(host));
  };
  return (
    <VStack gap={2}>
      <Heading level={3}>Allowed host names</Heading>
      <Text color="secondary">
        Names the server accepts besides 127.0.0.1 and localhost, like the machine’s name on your
        tailnet. A change applies at once.
      </Text>
      {note && <Text color="accent">{note}</Text>}
      {hosts.map((host) => (
        <HStack align="center" gap={2} key={host}>
          <EditableLine
            empty={EMPTY_HOST}
            field={`settings.host.${host}`}
            label={`Host name ${host}`}
            look="field"
            onSave={(text) => actions.editHost(host, text)}
            value={host}
          />
          <IconButton
            icon={<Icon icon="close" />}
            label={`Remove ${host}`}
            onClick={() => void remove(host)}
            variant="ghost"
          />
        </HStack>
      ))}
      {refused && <Banner collapsible={false} status="error" title={refused} />}
      <AddHost onSave={actions.addHost} />
    </VStack>
  );
}

/** Opening a browser at start, saved at once, with its refusal under it. */
function OpenBrowser({ actions, values }: { actions: ServerActions; values: ServerValues }) {
  const { openBrowser } = values.server;
  const note = overridden(openBrowser, (on) => (on ? "on" : "off"));
  const [refused, setRefused] = useState<string>();
  return (
    <VStack gap={2}>
      <Switch
        description="When the server starts, it opens Uraeda in your browser. A change applies at the next start."
        label="Open a browser at start"
        onChange={async (open: boolean) => {
          setRefused(undefined);
          setRefused(await actions.setOpenBrowser(open));
        }}
        value={openBrowser.saved ?? openBrowser.inForce}
      />
      {note && <Text color="accent">{note}</Text>}
      {refused && <Banner collapsible={false} status="error" title={refused} />}
    </VStack>
  );
}

/** A category of the settings file that cannot be read: its problem, and no control. */
export function FileProblem({ label, problem }: { label: string; problem: string }) {
  return (
    <VStack gap={4}>
      <Heading level={2}>{label}</Heading>
      <Banner
        collapsible={false}
        description="Fix the file to change settings here. Until then, the server uses its defaults."
        status="error"
        title={problem}
      />
    </VStack>
  );
}

/** The Server category, read-only with its problem when the file cannot be read. */
export function ServerSettings({
  actions,
  values,
}: {
  actions: ServerActions;
  values: ServerValues;
}) {
  if (values.problem) {
    return <FileProblem label="Server" problem={values.problem} />;
  }
  const { port } = values.server;
  const portNote = overridden(port, String);
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Heading level={2}>Server</Heading>
        <Text color="secondary">Kept in {values.file}, which you can also edit by hand.</Text>
      </VStack>
      <Hosts actions={actions} values={values} />
      <VStack gap={2}>
        <Heading level={3}>Port</Heading>
        <Text color="secondary" id="port-note">
          The port on 127.0.0.1. A change applies at the next start.
        </Text>
        {portNote && <Text color="accent">{portNote}</Text>}
        <HStack>
          <EditableLine
            describedBy="port-note"
            empty={EMPTY_PORT}
            field="settings.port"
            label="Port"
            look="field"
            onSave={actions.setPort}
            value={String(port.saved ?? port.inForce)}
          />
        </HStack>
      </VStack>
      <OpenBrowser actions={actions} values={values} />
    </VStack>
  );
}
