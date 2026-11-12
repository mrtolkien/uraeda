// The Sign-in category: every device paired with this server, a card each, with when it paired and
// when it was last seen, renamed in place, and revoked after a second, deliberate press: a revoked
// device is locked out at once. Then how to pair another, which `ura pair` does on the server's
// machine.
import { signal, View } from "nsh";
import { wordsOf } from "./categories";
import { savedField } from "./fields";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { call, extensionHost, record, serverDay, serverDaysAgo } from "../../store";
import type { Device } from "../../store/protocol";
import { Banner, Button, refusalOf, Text, Under } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { Card, Empty } from "../../ui/lists";
import { TextField } from "../../ui/text";

/** A day in words, from the server's today: "today", "yesterday", "3 days ago", "on 2 Nov". */
export function dayWords(iso: string, now: number = Date.now()): string {
  if (Number.isNaN(new Date(iso).getTime())) return "on an unknown day";
  const days = serverDaysAgo(iso, now);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return `on ${serverDay(iso, now)}`;
}

/** This device's id: the part of its token before the dot. None in a browser, signed in by cookie. */
function ownId(): string | undefined {
  return extensionHost().server().token?.split(".")[0];
}

/** A device's card: its name, its times, and its rename and revoke. */
function DeviceCard(props: { device: Device; onGone: (id: string, gone: boolean) => void }) {
  const pane = usePane();
  const renaming = pane.remember<string | null>("renaming", null);
  const asking = pane.remember<string | null>("revoking", null);
  const refusal = signal<string | null>(null);
  const own = () => props.device.id === ownId();
  const rename = savedField(
    `device-name-${props.device.id}`,
    () => props.device.name,
    async (name) => {
      await call("devices.rename", { id: props.device.id, name });
      renaming.set(null);
    },
  );
  const revoke = async () => {
    asking.set(null);
    refusal.set(null);
    props.onGone(props.device.id, true);
    try {
      await call("devices.revoke", { id: props.device.id });
    } catch (error) {
      props.onGone(props.device.id, false);
      refusal.set(refusalOf(error));
    }
  };
  const isAsking = () => asking() === props.device.id;
  return (
    <View style={{ gap: 6 }}>
      <Card
        actions={[
          { icon: "pencil", label: "Rename", run: () => renaming.set(props.device.id) },
          {
            icon: "log-out",
            label: "Revoke…",
            run: () => asking.set(props.device.id),
            variant: "danger",
          },
        ]}
        body={
          <If when={renaming() === props.device.id}>
            <TextField
              autoFocus
              label={`A new name for ${props.device.name}`}
              lines="one"
              onChange={rename.field.change}
              onEnter={() => void rename.submit()}
              refusal={rename.refusal()}
              value={rename.field.text()}
            />
          </If>
        }
        facts={[
          { icon: "calendar-clock", label: `Paired ${dayWords(props.device.created)}` },
          { icon: "eye", label: `Last seen ${dayWords(props.device.used)}` },
        ]}
        icon={own() ? "monitor" : "smartphone"}
        state={own() ? { label: "This device", tone: "accent" } : undefined}
        title={props.device.name}
      />
      <If when={isAsking()}>
        <Banner
          action={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Keep it" onPress={() => asking.set(null)} />
              <Button label="Revoke" onPress={() => void revoke()} variant="danger" />
            </View>
          }
          title={`Revoke ${props.device.name}?`}
          tone="danger"
        >
          {own()
            ? "This device is locked out at once: its token signs in nowhere any more, and the app asks to pair it again, with a new code from ura pair."
            : "It is locked out at once: its token signs in nowhere any more, and its open windows close. Pairing it again takes a new code from ura pair."}
        </Banner>
      </If>
      <Under refusal={refusal()} />
    </View>
  );
}

/** The paired devices, oldest first: a revoked one goes at once, and comes back if refused. */
function Devices() {
  const devices = record("Devices", null);
  const gone = signal<ReadonlyArray<string>>([]);
  const shown = () => (devices()?.devices ?? []).filter((one) => !gone().includes(one.id));
  const onGone = (id: string, isGone: boolean) =>
    gone.set(isGone ? [...gone(), id] : gone().filter((one) => one !== id));
  return (
    <If when={devices() !== undefined} else={<Text tone="faint">Reading the paired devices…</Text>}>
      <View style={{ gap: 10 }}>
        <Each key={(device: Device) => device.id} of={shown()}>
          {(device) => <DeviceCard device={device()} onGone={onGone} />}
        </Each>
        <If when={shown().length === 0}>
          <Empty
            icon="smartphone"
            title="No device is paired"
            words="This window signs in with the access key. Pair a device below, and it signs in with a token of its own."
          />
        </If>
      </View>
    </If>
  );
}

/** The category's rows. */
const ROWS = () => [{ id: "devices" }, { id: "pair" }, { id: "browser" }];

export function SignIn() {
  return (
    <FieldRows rows={ROWS}>
      <FieldRow
        {...wordsOf("sign-in", "Paired devices")}
        icon="users"
        id="devices"
        under={<Devices />}
      />
      <FieldRow
        {...wordsOf("sign-in", "Pair another device")}
        icon="smartphone"
        id="pair"
        under={
          <View style={{ gap: 4 }}>
            <Text font="code">ura pair</Text>
            <Text tone="faint">
              On a phone, scan its QR code, or enter the code at the address it prints; on another
              machine, start uraeda --server with that address, and give it the code. A code pairs
              one device, within 10 minutes.
            </Text>
          </View>
        }
      />
      <FieldRow
        {...wordsOf("sign-in", "Sign a browser in")}
        icon="globe"
        id="browser"
        under={
          <View style={{ gap: 4 }}>
            <Text font="code">ura key</Text>
            <Text tone="faint">
              It shows the access key once, and keeps only its hash, so it never shows it again:
              keep it in a password manager. ura key --replace makes a new one for a lost one, and
              signs every browser and device out, this app too, which then asks to pair again.
            </Text>
          </View>
        }
      />
    </FieldRows>
  );
}
