// The Server category: the host names the server accepts, its port, and whether it opens a browser
// when it starts, each as the settings file holds it, with the value in force when a flag or a
// variable overrides it for this run.
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { EditableLine } from "../EditableLine.tsx";

/** Where the value in force comes from. */
export type Source =
  | { kind: "default" }
  | { kind: "file" }
  | { kind: "flag"; name: string }
  | { kind: "environment"; name: string };

/** One setting: the file's value, absent when the file does not set it, and the one in force. */
export type Setting<T> = { inForce: T; saved: T | undefined; source: Source };

/** The Server category's values, as the server reads them. */
export type ServerValues = {
  allowedHosts: Setting<ReadonlyArray<string>>;
  /** The host name this browser reached the server through. */
  currentHost: string;
  /** The settings file, with `~` for the home folder. */
  file: string;
  openBrowser: Setting<boolean>;
  port: Setting<number>;
  /** Why the settings file could not be read, when it could not: the page then takes no change. */
  problem?: string;
};

/** What the category changes: each resolves with the error to show, or nothing once saved. */
export type ServerActions = {
  addHost: (name: string) => Promise<string | undefined>;
  editHost: (from: string, to: string) => Promise<string | undefined>;
  removeHost: (name: string) => void;
  setOpenBrowser: (open: boolean) => void;
  setPort: (port: string) => Promise<string | undefined>;
};

/** "Set by --port for this run: 4400.", when a flag or a variable overrides the file. */
function overridden<T>(setting: Setting<T>, show: (value: T) => string): string | undefined {
  const { inForce, source } = setting;
  if (source.kind !== "flag" && source.kind !== "environment") {
    return undefined;
  }
  return `Set by ${source.name} for this run: ${show(inForce)}.`;
}

/** The host names, one line each, edited in place, then the line that adds one. */
function Hosts({ actions, values }: { actions: ServerActions; values: ServerValues }) {
  const hosts = values.allowedHosts.saved ?? [];
  const note = overridden(values.allowedHosts, (names) => names.join(", ") || "none");
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
            field={`settings.host.${host}`}
            label={`Host name ${host}`}
            onSave={(text) => actions.editHost(host, text)}
            value={host}
          />
          <IconButton
            icon={<Icon icon="close" />}
            label={`Remove ${host}`}
            onClick={() => actions.removeHost(host)}
            variant="ghost"
          />
        </HStack>
      ))}
      <EditableLine
        display="＋ Add a host name"
        field="settings.host.new"
        label="New host name"
        onSave={actions.addHost}
        stayOpen
        value=""
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
    return (
      <VStack gap={4}>
        <Heading level={2}>Server</Heading>
        <Banner
          collapsible={false}
          description="Fix the file to change settings here. Until then, the server uses its defaults."
          status="error"
          title={values.problem}
        />
      </VStack>
    );
  }
  const port = overridden(values.port, String);
  const open = overridden(values.openBrowser, (on) => (on ? "on" : "off"));
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <Heading level={2}>Server</Heading>
        <Text color="secondary">Kept in {values.file}, which you can also edit by hand.</Text>
      </VStack>
      <Hosts actions={actions} values={values} />
      <VStack gap={2}>
        <Heading level={3}>Port</Heading>
        <Text color="secondary">The port on 127.0.0.1. A change applies at the next start.</Text>
        {port && <Text color="accent">{port}</Text>}
        <EditableLine
          field="settings.port"
          label="Port"
          onSave={actions.setPort}
          value={String(values.port.saved ?? values.port.inForce)}
        />
      </VStack>
      <VStack gap={2}>
        <Switch
          description="When the server starts, it opens Uraeda in your browser. A change applies at the next start."
          label="Open a browser at start"
          onChange={actions.setOpenBrowser}
          value={values.openBrowser.saved ?? values.openBrowser.inForce}
        />
        {open && <Text color="accent">{open}</Text>}
      </VStack>
    </VStack>
  );
}
