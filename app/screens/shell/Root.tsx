// The app from its first frame: it asks the host for the server, which on this machine is started
// when none runs, signs the device in with its token, pairing it first when it has none, and draws
// the frame once the server welcomed it. Each other state has a page of its own that says why, and
// what the owner can do: the server starting, the device to pair, a version to update.
//
// After the server stopped, the frame stays, with its records as they were, under a banner that
// says so, while the host starts this machine's server again or the store tries another's. A
// server started again on another port takes the same connection there, so the frame keeps its
// values, marked stale, until the server gives its own.
import { batch, cleanup, effect, signal, untracked, View } from "nsh";
import { Frame } from "./Frame";
import { failureWords, type Server, setLeaveServer, type ShellHost } from "./host";
import { Lone } from "./Lone";
import { Stopped } from "./Stopped";
import {
  connect,
  type Connection,
  type Opener,
  pathOf,
  RecordsRoot,
  rootDrawn,
  route,
} from "../../store";
import type { SignIn } from "../../store/protocol";
import { picks, SandboxPick } from "../../sandbox/Pick";
import { Connect } from "../sign-in/Connect";
import { Pairing } from "../sign-in/Pairing";
import { Update } from "../sign-in/Update";
import { Button, Spinner } from "../../ui/controls";
import { KeysHost } from "../../ui/keys";
import { LeaveGuard } from "../../ui/text";

type Phase =
  | { is: "finding" }
  // A device whose owner has not named its server yet.
  | { is: "naming" }
  | { is: "failed"; words: string }
  | { is: "pairing"; server: Server; why?: string }
  | { is: "connected"; server: Server; conn: Connection; generation: number };

export type RootProps = {
  /** How long a record nobody reads stays subscribed, for a test that waits for it: the store's. */
  grace?: number;
  host: ShellHost;
  /** The seam to the line, which a test wraps: the platform's WebSocket unless given. */
  open?: Opener;
};

export function Root(props: RootProps) {
  const phase = signal<Phase>({ is: "finding" });
  let generation = 0;

  const start = (server: Server, signIn: SignIn) => {
    const conn = connect({
      address: server.address,
      grace: props.grace,
      open: props.open,
      signIn,
    });
    generation += 1;
    phase.set({ conn, generation, is: "connected", server });
  };

  const find = async (why?: string) => {
    // A device with no server of its own asks its owner for one, once.
    if (props.host.remote !== undefined && props.host.remote.address() === undefined) {
      return phase.set({ is: "naming" });
    }
    phase.set({ is: "finding" });
    try {
      const server = await props.host.server();
      if (server.open === true) return start(server, { by: "cookie" });
      let token = await props.host.token();
      // On its own machine, the app pairs by itself, with its server's host token.
      if (token === null && server.local) token = await props.host.pair(null);
      if (token === null) return phase.set({ is: "pairing", server, why });
      start(server, { by: "token", token });
    } catch (error) {
      phase.set({ is: "failed", words: failureWords(error) });
    }
  };
  void find();

  // On a device, the way to another server: this one and its token are forgotten.
  const leave =
    props.host.remote === undefined
      ? undefined
      : () => {
          const now = phase();
          if (now.is === "connected") now.conn.close();
          void props.host.remote?.leave().then(() => find());
        };
  setLeaveServer(leave);
  cleanup(() => setLeaveServer(undefined));

  // A token the server no longer knows, as a revoked device's: the device pairs again.
  effect(() => {
    const now = phase();
    if (now.is !== "connected" || now.conn.refused()?.update !== "sign-in") return;
    untracked(() => {
      now.conn.close();
      void props.host.forget();
      phase.set({
        is: "pairing",
        // Where the connection went last: the server may have moved since it was found.
        server: { ...now.server, address: now.conn.address },
        why: "This device was unpaired from the server, or the server's access key changed.",
      });
    });
  });

  const failed = () => {
    const now = phase();
    return now.is === "failed" ? now.words : undefined;
  };
  const pairing = () => {
    const now = phase();
    return now.is === "pairing" ? now : undefined;
  };
  const connected = () => {
    const now = phase();
    return now.is === "connected" ? [now] : [];
  };

  // From here on, a record read outside these views, where nothing lets it go, is told.
  rootDrawn();
  return (
    <RecordsRoot value>
      <KeysHost place={pathOf(route())}>
        <LeaveGuard />
        <If when={phase().is === "naming"}>
          <Connect host={props.host} onNamed={(why) => void find(why)} />
        </If>
        <If when={phase().is === "finding"}>
          <Lone
            icon="server"
            title={leave === undefined ? "Starting Uraeda's server" : "Finding your server"}
            words={
              leave === undefined
                ? "The app finds the server that runs on this machine, or starts one, and waits until it answers."
                : `At ${props.host.remote?.address() ?? "its address"}.`
            }
          >
            <Spinner label="Waiting for the server" />
          </Lone>
        </If>
        <If when={failed()}>
          {(words) => (
            <Lone
              icon="triangle-alert"
              title={
                leave === undefined ? "Uraeda's server did not start" : "Your server did not answer"
              }
              tone="danger"
              words={words()}
            >
              <View
                style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}
              >
                <Button icon="refresh-cw" label="Try again" onPress={() => void find()} />
                <If when={leave}>
                  {(go) => <Button icon="server" label="Use another server" onPress={go()} />}
                </If>
              </View>
            </Lone>
          )}
        </If>
        <If when={pairing()}>
          {(now) => (
            <Pairing
              host={props.host}
              onLeave={leave}
              onPaired={(token) => start(now().server, { by: "token", token })}
              server={now().server}
              why={now().why}
            />
          )}
        </If>
        <Each key={(now) => now.generation} of={connected()}>
          {(now) => (
            <Connected conn={now().conn} host={props.host} onLeave={leave} server={now().server} />
          )}
        </Each>
        <If when={picks}>
          <SandboxPick />
        </If>
      </KeysHost>
    </RecordsRoot>
  );
}

/** The app under one connection: the frame once welcomed, else why not. */
function Connected(props: {
  conn: Connection;
  host: ShellHost;
  /** On a device, the way to another server. */
  onLeave?: () => void;
  server: Server;
}) {
  const conn = props.conn;
  // The server reached now: this machine's may start again on another port.
  const server = signal(props.server);
  // The server stopped while the app was open: this machine's is started again by the host.
  const recovering = signal(false);
  const failed = signal<string | undefined>(undefined);
  const recover = async () => {
    batch(() => {
      recovering.set(true);
      failed.set(undefined);
    });
    try {
      const found = await props.host.server();
      // Its records keep their values, marked stale, until the server found gives its own.
      if (found.address !== conn.address) server.set(found);
      conn.moveTo(found.address);
    } catch (error) {
      failed.set(failureWords(error));
    }
    recovering.set(false);
  };
  effect(() => {
    if (conn.stale() && server().local) untracked(() => void recover());
  });

  const refused = () => {
    const why = conn.refused();
    return conn.status() === "refused" && why?.update !== "sign-in" ? why : undefined;
  };
  const shown = () => conn.status() === "live" || conn.stale();
  const reaching = () => !shown() && conn.status() !== "refused";

  return (
    <>
      <If when={refused()}>{(why) => <Update refused={why()} server={server()} />}</If>
      <If when={shown()}>
        <Frame />
        <If when={conn.stale()}>
          <Stopped
            failed={failed()}
            local={server().local}
            onRetry={() => (server().local ? void recover() : conn.reconnect())}
            recovering={recovering()}
            server={server()}
          />
        </If>
      </If>
      <If when={reaching()}>
        <Lone
          icon="server"
          title="Reaching Uraeda's server"
          words={
            conn.status() === "offline"
              ? `It does not answer at ${server().address} yet. The app tries again every few seconds.`
              : `At ${server().address}.`
          }
        >
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
            <Spinner label="Connecting" />
            <If when={conn.status() === "offline"}>
              <Button icon="refresh-cw" label="Try now" onPress={() => conn.reconnect()} />
              <If when={props.onLeave}>
                {(go) => <Button icon="server" label="Use another server" onPress={go()} />}
              </If>
            </If>
          </View>
        </Lone>
      </If>
    </>
  );
}
