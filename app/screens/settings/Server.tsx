// The Server category: the host names the server accepts, its port, and whether it opens a browser
// as it starts, each as the settings file holds it, with the value in force when a flag or a
// variable sets it for this run. Removing the name this device reaches the server through asks
// first: the server refuses this device from the next request.
import { signal, View } from "nsh";
import { FileProblem, savedField, settingsRecord } from "./fields";
import { wordsOf } from "./categories";
import { fromWords, isOverridden, onOff } from "./Row";
import { FieldRow, FieldRows } from "../../ui/lists";
import { call, extensionHost } from "../../store";
import { Button, IconButton, refusalOf, sent, Switch, Text } from "../../ui/controls";
import { TextField } from "../../ui/text";

/** The host name in the address this device reaches the server at. */
function ownHost(): string {
  const address = extensionHost().server().address;
  try {
    return new URL(address).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** The allowed host names: one line each, with its remove, then the field that adds one. */
function Hosts(props: { names: ReadonlyArray<string>; onRefused: (words: string | null) => void }) {
  const asking = signal<string | null>(null);
  // A name removed goes from the list at once, and comes back if the server refuses.
  const gone = signal<ReadonlyArray<string>>([]);
  const add = savedField(
    "host-new",
    () => "",
    async (name) => {
      await call("settings.addHost", { name });
      // A name removed earlier and added again shows again.
      gone.set(gone().filter((one) => one !== name.trim().toLowerCase()));
    },
    true,
  );
  const remove = async (name: string) => {
    asking.set(null);
    props.onRefused(null);
    gone.set([...gone(), name]);
    try {
      await call("settings.removeHost", { name });
    } catch (error) {
      props.onRefused(refusalOf(error));
      gone.set(gone().filter((one) => one !== name));
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Each key={(name: string) => name} of={props.names.filter((name) => !gone().includes(name))}>
        {(name) => (
          <View style={{ gap: 4 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Text font="code" style={{ flex: 1 }}>
                {name()}
              </Text>
              <IconButton
                icon="x"
                label={`Remove ${name()}`}
                onPress={() => (name() === ownHost() ? asking.set(name()) : void remove(name()))}
              />
            </View>
            <If when={asking() === name()}>
              <View style={{ alignItems: "flex-start", gap: 6 }}>
                <Text tone="caution">
                  {`This device reaches Uraeda through ${name()}. Once it is removed, the server refuses this device until the name is added again, from another device or in the file.`}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button label="Keep it" onPress={() => asking.set(null)} />
                  <Button
                    label={`Remove ${name()}`}
                    onPress={() => void remove(name())}
                    variant="danger"
                  />
                </View>
              </View>
            </If>
          </View>
        )}
      </Each>
      <TextField
        label="Add a host name"
        lines="one"
        onChange={add.field.change}
        onEnter={() => void add.submit()}
        hint="Enter adds it."
        placeholder="mac.tail1234.ts.net"
        refusal={add.refusal()}
        value={add.field.text()}
      />
    </View>
  );
}

/** A row's words, by its name. */
const words = (label: string) => wordsOf("server", label);

export function Server() {
  const settings = settingsRecord();
  const server = () => settings()?.server;
  const hostsRefused = signal<string | null>(null);
  const port = savedField(
    "port",
    () => String(server()?.port.saved ?? server()?.port.inForce ?? ""),
    (typed) => call("settings.setPort", { port: typed.trim() }),
  );
  const browser = sent(
    () => server()?.openBrowser.saved ?? server()?.openBrowser.inForce ?? true,
    (open) => call("settings.setOpenBrowser", { open }),
  );
  const rows = () =>
    settings()?.problem === null
      ? [
          { id: "hosts" },
          { id: "port" },
          { act: () => browser.set(!browser.value()), id: "browser" },
        ]
      : [];
  return (
    <View style={{ gap: 12 }}>
      <If
        when={settings()?.problem}
        else={
          <Text tone="quiet">{`Kept in ${settings()?.file ?? "config.toml"}, which you can also edit by hand.`}</Text>
        }
      >
        {(problem) => <FileProblem file={settings()!.file} problem={problem()} />}
      </If>
      <FieldRows rows={rows}>
        <If when={settings()?.problem === null ? server() : undefined}>
          {(shown) => (
            <>
              <FieldRow
                {...words("Allowed host names")}
                from={fromWords(shown().allowedHosts, (names) => names.join(", ") || "none")}
                icon="globe"
                id="hosts"
                overridden={isOverridden(shown().allowedHosts)}
                refusal={hostsRefused()}
                under={
                  <Hosts names={shown().allowedHosts.saved ?? []} onRefused={hostsRefused.set} />
                }
              />
              <FieldRow
                {...words("Port")}
                control={
                  <TextField
                    label="Port"
                    lines="one"
                    onBlur={() => port.field.dirty() && void port.submit()}
                    onChange={port.field.change}
                    onEnter={() => void port.submit()}
                    style={{ width: 120 }}
                    value={port.field.text()}
                  />
                }
                from={fromWords(shown().port, String)}
                icon="plug"
                id="port"
                overridden={isOverridden(shown().port)}
                refusal={port.refusal()}
              />
              <FieldRow
                {...words("Open a browser at start")}
                control={
                  <Switch
                    label={onOff(browser.value())}
                    onChange={browser.set}
                    pending={browser.pending()}
                    value={browser.value()}
                  />
                }
                from={fromWords(shown().openBrowser, onOff)}
                icon="external-link"
                id="browser"
                overridden={isOverridden(shown().openBrowser)}
                refusal={browser.refusal()}
              />
            </>
          )}
        </If>
      </FieldRows>
    </View>
  );
}
