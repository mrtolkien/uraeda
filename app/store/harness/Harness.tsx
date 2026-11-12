// The app `store.test.ts` opens: the client store against the sandbox `just app-test` starts, its
// address in `URAEDA_SANDBOX`. The test file's own engine has no network, and reads no variable of
// the environment: an app opened with `network: "live"` does, under the `nsh.json` of this folder.
//
// The test plays the host: each `step` event does one thing, and the app posts its `facts`, what a
// caller sees, after each change. A connection's line is the platform's WebSocket, wrapped by the
// seam to see what is sent, hold what comes, or drop it, and to hand its connection a frame of the
// test's own (`inject`). `move` sends a connection to another address: the sandbox's with a slash
// after it, the same server under another name.
import { effect, host, mount, signal, Text, View } from "nsh";
import { unpackFrame } from "uraeda/native";
import { valueAt } from "../apply";
import { Connection } from "../connection";
import { list, read, text } from "../records";
import type { Opener } from "../line";
import { openSocket } from "../line";
import type { JsonValue } from "../protocol";

type Step =
  | { do: "connect"; conn: string; protocol?: number; grace?: number }
  | {
      do: "read";
      conn: string;
      key: string;
      name: string;
      args: JsonValue;
      pick?: string[];
      text?: string[];
      rows?: string;
    }
  | { do: "unread"; key: string }
  | { do: "call"; conn: string; key: string; name: string; input: JsonValue }
  | { do: "hold" | "release" | "drop" | "close"; conn: string }
  | { do: "inject"; conn: string; bytes: number[] }
  | { do: "move"; conn: string; to: string };

type Frame = string | ArrayBuffer;

type Wire = {
  got: JsonValue[];
  sent: JsonValue[];
  held: Frame[] | undefined;
  deliver?: (frame: Frame) => void;
  drop?: () => void;
  opened: number;
};

const address = process.env.URAEDA_SANDBOX ?? "";
const conns = new Map<string, Connection>();
const wires = new Map<string, Wire>();
const facts: Record<string, Record<string, JsonValue>> = { calls: {}, conns: {}, reads: {} };
const reads = signal<Array<Extract<Step, { do: "read" }>>>([]);

let posting: number | undefined;
function tell() {
  for (const [name, conn] of conns) {
    const wire = wires.get(name)!;
    facts.conns![name] = {
      got: wire.got,
      held: wire.held?.length ?? null,
      open: conn.subscriptions(),
      opened: wire.opened,
      refused: (conn.refused() as JsonValue) ?? null,
      sent: wire.sent,
      stale: conn.stale(),
      status: conn.status(),
    };
  }
  posting ??= setTimeout(() => {
    posting = undefined;
    host.post("facts", JSON.parse(JSON.stringify(facts)));
  }, 0);
}

/** The seam: the real socket, with what is sent kept, what comes held on demand, and a drop. */
function wired(name: string, protocol: number | undefined): Opener {
  const wire: Wire = { got: [], held: undefined, opened: 0, sent: [] };
  wires.set(name, wire);
  return (url, heard) => {
    wire.opened += 1;
    const line = openSocket(url, {
      closed: () => {
        heard.closed();
        tell();
      },
      message: (said) => {
        const binary = typeof said !== "string";
        const message = binary ? (unpackFrame(new Uint8Array(said)).text ?? "{}") : said;
        const { id, type } = JSON.parse(message) as { id?: number; type?: string };
        wire.got.push({ binary, id: id ?? null, type: type ?? "unreadable" });
        if (wire.held !== undefined) wire.held.push(said);
        else heard.message(said);
        tell();
      },
      opened: heard.opened,
    });
    wire.deliver = heard.message;
    wire.drop = () => line.close();
    return {
      close: () => line.close(),
      send: (said) => {
        const message = JSON.parse(said) as { type: string; protocol?: number };
        if (message.type === "hello" && protocol !== undefined) message.protocol = protocol;
        wire.sent.push(message as JsonValue);
        line.send(JSON.stringify(message));
        tell();
      },
    };
  };
}

function step(it: Step) {
  const wire = "conn" in it ? wires.get(it.conn) : undefined;
  switch (it.do) {
    case "connect": {
      const conn = new Connection({
        address,
        grace: it.grace ?? 0,
        open: wired(it.conn, it.protocol),
        signIn: { by: "cookie" },
      });
      conns.set(it.conn, conn);
      effect(() => {
        conn.status();
        conn.refused();
        tell();
      });
      return;
    }
    case "read":
      reads.update((all) => [...all, it]);
      return;
    case "unread":
      reads.update((all) => all.filter((one) => one.key !== it.key));
      return;
    case "call": {
      const started = Date.now();
      conns
        .get(it.conn)!
        .call(it.name, it.input)
        .then(
          (output) => {
            facts.calls![it.key] = { ms: Date.now() - started, output: output as JsonValue };
          },
          (error: { code: string; message: string }) => {
            facts.calls![it.key] = {
              code: error.code,
              message: error.message,
              ms: Date.now() - started,
            };
          },
        )
        .finally(tell);
      return;
    }
    case "hold":
      wire!.held = [];
      break;
    case "release": {
      const held = wire!.held ?? [];
      wire!.held = undefined;
      for (const said of held) wire!.deliver?.(said);
      break;
    }
    case "drop":
      wire!.drop?.();
      break;
    case "inject":
      wire!.deliver?.(new Uint8Array(it.bytes).buffer);
      break;
    case "close":
      conns.get(it.conn)!.close();
      break;
    case "move":
      conns.get(it.conn)!.moveTo(it.to);
      break;
  }
  tell();
}

/** One record read, for as long as its step is in `reads`. */
function Read(props: { it: Extract<Step, { do: "read" }> }) {
  const it = props.it;
  const live = read(conns.get(it.conn)!, it.name as "Settings", it.args as null);
  const seen: Record<string, JsonValue> = { texts: [], values: [] };
  facts.reads![it.key] = seen;
  effect(() => {
    const value = live() as JsonValue | undefined;
    const values = seen.values as JsonValue[];
    values.push(value === undefined ? null : (valueAt(value, it.pick ?? []) ?? null));
    seen.error = live.error()?.code ?? null;
    tell();
  });
  if (it.text !== undefined) {
    const grown = text(live, it.text);
    effect(() => {
      (seen.texts as string[]).push(grown());
      tell();
    });
  }
  if (it.rows !== undefined) {
    const rows = list<{ id: string }>(live, [it.rows]).rows;
    effect(() => {
      seen.rows = rows().map((row) => row.id);
      tell();
    });
  }
  return <View />;
}

host.on("step", (data) => step(data as Step));

mount(() => (
  <View>
    <Text>{address === "" ? "No sandbox: run with `just app-test`." : address}</Text>
    <Each of={reads()}>{(it) => <Read it={it()} />}</Each>
  </View>
));
