// An agent runtime that answers each message with its own text.
import type { AgentEvent, AgentProcess, OpenOptions, Outgoing, ServerApi } from "uraeda/server";

/** A queue of events an async loop reads, ended by `close`. */
function queue() {
  const waiting: Array<AgentEvent> = [];
  let wake: (() => void) | undefined;
  let closed = false;
  const push = (event: AgentEvent) => {
    waiting.push(event);
    wake?.();
  };
  async function* events(): AsyncGenerator<AgentEvent> {
    for (;;) {
      while (waiting.length > 0) {
        yield waiting.shift()!;
      }
      if (closed) {
        return;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  }
  return {
    close: () => {
      closed = true;
      wake?.();
    },
    events: events(),
    push,
  };
}

function open(options: OpenOptions): AgentProcess {
  const { close, events, push } = queue();
  push({ sessionId: `echo-${options.nativeId}`, type: "init" });
  return {
    close() {
      push({ code: 0, stderr: "", type: "exit" });
      close();
    },
    events,
    interrupt() {
      push({ denials: [], errors: [], interrupted: true, ok: true, type: "result" });
    },
    kill() {
      push({ code: null, stderr: "killed", type: "exit" });
      close();
    },
    send(message: Outgoing) {
      push({ id: message.id, type: "accepted" });
      push({ text: `You said: ${message.text}`, type: "text" });
      push({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
    },
    takeBack(id) {
      push({ id, type: "cancelled" });
    },
  };
}

export default function activate(api: ServerApi) {
  api.runtime({
    accounts: {
      list: () => [
        {
          askedAt: 1_794_301_200_000,
          id: "/accounts/one",
          known: true,
          name: "one",
          state: "ready",
          windows: [{ id: "five_hour", label: "5h", resetsAt: null, used: 0.25 }],
        },
      ],
      nameOf: (id) => (id === "/accounts/one" ? "one" : id),
      problems: () => ["account two is signed out"],
      refresh: async () => {},
    },
    allowRule: (denial) => `allow ${denial.tool}`,
    capabilities: {
      approvals: false,
      images: false,
      queue: true,
      steer: false,
      subagents: false,
      takeBack: true,
    },
    hasSession: (nativeId, account) => nativeId === "known" && account !== "/accounts/apart",
    icon: "uraeda:plug",
    kind: "echo",
    models: async () => ({
      defaults: { model: "small" },
      models: [{ efforts: [], id: "small", name: "Small" }],
    }),
    name: "Echo agent",
    open,
    version: async () => "1.2.3",
  });
}
