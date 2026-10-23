// The Server section: the host names the server accepts, its port, and whether it opens a browser
// when it starts, each a row of the form as the settings file holds it, with the value in force
// when a flag or a variable overrides it for this run.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
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
import { type Category, settingOf } from "./categories.ts";
import { SettingRow, SettingRows } from "./SettingRow.tsx";

/** The settings record, as the page reads it: the file, its problem, and the values. */
export type ServerValues = Pick<Settings, "file" | "problem" | "runs" | "server">;

/** Where a value in force comes from, as the record says. */
type Source = ServerValues["server"]["port"]["source"];

/**
 * What the sections of the settings file change, each through the server: each resolves with
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
      <Button
        icon={<Icon icon="uraeda:plus" />}
        label="Add a host name"
        onClick={line.openLine}
        variant="secondary"
      />
    </HStack>
  );
}

/** The host names, one line each, edited in place, then the line that adds one. */
function Hosts({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const { allowedHosts } = values.server;
  const hosts = allowedHosts.saved ?? [];
  const note = overridden(allowedHosts, (names) => names.join(", ") || "none");
  const [refused, setRefused] = useState<string>();
  const remove = async (host: string) => {
    setRefused(undefined);
    setRefused(await actions.removeHost(host));
  };
  return (
    <SettingRow
      notes={
        <>
          {note && <Text color="accent">{note}</Text>}
          {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
        </>
      }
      setting={settingOf(category, "Allowed host names")}
    >
      <VStack gap={2}>
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
        <AddHost onSave={actions.addHost} />
      </VStack>
    </SettingRow>
  );
}

/** The port, edited in place, saved for the next start. */
function Port({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const { port } = values.server;
  const note = overridden(port, String);
  return (
    <SettingRow
      notes={note && <Text color="accent">{note}</Text>}
      setting={settingOf(category, "Port")}
    >
      <HStack>
        <EditableLine
          empty={EMPTY_PORT}
          field="settings.port"
          label="Port"
          look="field"
          onSave={actions.setPort}
          value={String(port.saved ?? port.inForce)}
        />
      </HStack>
    </SettingRow>
  );
}

/** Opening a browser at start, saved at once, with its refusal under it. */
function OpenBrowser({
  actions,
  category,
  values,
}: {
  actions: ServerActions;
  category: Category;
  values: ServerValues;
}) {
  const { openBrowser } = values.server;
  const setting = settingOf(category, "Open a browser at start");
  const note = overridden(openBrowser, (on) => (on ? "on" : "off"));
  const [refused, setRefused] = useState<string>();
  return (
    <SettingRow
      notes={
        <>
          {note && <Text color="accent">{note}</Text>}
          {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
        </>
      }
      setting={setting}
    >
      <Switch
        isLabelHidden
        label={setting.label}
        onChange={async (open: boolean) => {
          setRefused(undefined);
          setRefused(await actions.setOpenBrowser(open));
        }}
        value={openBrowser.saved ?? openBrowser.inForce}
      />
    </SettingRow>
  );
}

/** A section of the settings file that cannot be read: its problem, and no control. */
export function FileProblem({ problem }: { problem: string }) {
  return (
    <VStack padding={3}>
      <AnnouncedBanner
        collapsible={false}
        description="Fix the file to change settings here. Until then, the server uses its defaults."
        status="error"
        title={problem}
      />
    </VStack>
  );
}

/**
 * The Server section's rows that `shows` keeps, under the file they are kept in; its problem alone
 * when the file cannot be read.
 */
export function ServerSettings({
  actions,
  category,
  shows,
  values,
}: {
  actions: ServerActions;
  category: Category;
  shows: (label: string) => boolean;
  values: ServerValues;
}) {
  if (values.problem) {
    return <FileProblem problem={values.problem} />;
  }
  const props = { actions, category, values };
  return (
    <VStack>
      <VStack paddingBlockStart={2} paddingInline={3}>
        <Text color="secondary">Kept in {values.file}, which you can also edit by hand.</Text>
      </VStack>
      <SettingRows>
        {shows("Allowed host names") && <Hosts {...props} />}
        {shows("Port") && <Port {...props} />}
        {shows("Open a browser at start") && <OpenBrowser {...props} />}
      </SettingRows>
    </VStack>
  );
}
