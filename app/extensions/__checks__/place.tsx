// The app's side of `crates/app/tests/extensions.rs`: one `ExtensionPlace` for each extension its
// host names, in the light theme, over stand-ins of the client store (task 23). Each extension's
// record `count` reads 3, its action `add` answers the count after the one seen, and every call
// of the store goes to the host as `called`. What a page declared goes to the host as `ready`, and
// what broke as `problem`.
import { host, mount, signal, View } from "nsh";
import { applyTheme } from "../../ui/theme";
import { DEFAULT_THEMES } from "../../ui/tokens";
import { ExtensionPlace } from "../ExtensionPlace";
import type { ExtensionHost } from "../host";

type Params = { server: string; token: string; names: string[]; version: number; probe: string };

const params = host.params as unknown as Params;
const version = signal(params.version);
host.on<number>("version", (next) => version.set(next));

const store: ExtensionHost = {
  server: () => ({ address: params.server, token: params.token }),
  read(name, args, seen) {
    if (name === "ExtensionRecord")
      seen({ error: undefined, value: { error: null, value: { count: 3 } } } as never);
    else seen({ error: "no such record here", value: undefined });
    host.post("called", { args, name, read: true });
    return () => host.post("called", { args, name, stopped: true });
  },
  call(name, input) {
    host.post("called", { input, name });
    const asked = input as { name?: string; input?: { seen?: number } };
    const output = asked.name === "add" ? { count: (asked.input?.seen ?? 0) + 1 } : null;
    return Promise.resolve((name === "extensions.act" ? { output } : null) as never);
  },
};

applyTheme(DEFAULT_THEMES.light);

function Places() {
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {params.names.map((name) => (
        <View style={{ flex: 1 }}>
          <ExtensionPlace
            extension={() => ({ name, pageVersion: version(), title: name })}
            host={store}
            onProblem={(problem) => host.post("problem", { name, problem })}
            onReady={(declarations) => host.post("ready", { declarations, name })}
            part={{ id: name, kind: "place" }}
            props={() => ({ probe: params.probe })}
            repo="todo-app"
          />
        </View>
      ))}
    </View>
  );
}

mount(Places);
