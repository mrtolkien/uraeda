// What `updates.test.tsx` opens: the settings' Updates row and the toasts, as the app draws them,
// over an updater the page plays, since `nsh test` runs no package. `host.params.scenario` says
// what the release does:
//
// - `newer`: version 1.5.0 is out, and installs here: its download stops half way until the test
//   presses "Finish download", then the app "restarts", which the page says.
// - `elsewhere`: 1.5.0 is out, and this copy cannot replace itself (an AppImage).
// - `broken`: 1.5.0 is out, and its download fails.
// - `latest`: nothing newer is out.
// - `development`: the app has no version, as in a browser or a development run.
import { host, mount, signal, Text, View } from "nsh";
import type { AppUpdate, UpdateProgress } from "nsh/updater";
import { device } from "../../../store";
import { checkAtStart, standInForUpdater, UpdateToast } from "../../shell/updates";
import { Updates } from "../Updates";
import { KeysHost } from "../../../ui/keys/KeysHost";
import { KeyScope } from "../../../ui/keys/registry";
import { PaneContext } from "../../../ui/layout/panes";
import { Toasts } from "../../../ui/surfaces";

const scenario = String(host.params.scenario ?? "newer");
const restarted = signal(false);
let finish: () => void = () => undefined;
const finishing = signal(false);

const release = (canInstall: boolean): AppUpdate => ({
  canInstall,
  notes: null,
  url: "https://example.com/uraeda-1.5.0-linux-x86_64.tar.gz",
  version: "1.5.0",
});

standInForUpdater({
  checkForUpdate: async () => (scenario === "latest" ? null : release(scenario !== "elsewhere")),
  downloadUpdate: async (onProgress?: ((progress: UpdateProgress) => void) | null) => {
    if (scenario === "broken") throw new Error("the archive's SHA-256 does not match");
    onProgress?.({ received: 50, total: 100 });
    finishing.set(true);
    await new Promise<void>((done) => {
      finish = done;
    });
    onProgress?.({ received: 100, total: 100 });
  },
  installAndRestart: () => {
    restarted.set(true);
    return new Promise<void>(() => undefined);
  },
  shellInfo: () => ({
    build: scenario === "development" ? null : 1,
    nshVersion: "0.5.0",
    packages: false,
    version: scenario === "development" ? null : "1.4.0",
  }),
});

const here = { focused: () => true, key: "updates-check", width: () => "wide" as const };

void device.load().then(() =>
  mount(() => {
    checkAtStart();
    return (
      <KeysHost>
        <KeyScope name="Checks">
          <PaneContext.Provider value={here}>
            <View style={{ flex: 1, padding: 16 }}>
              <Updates />
              <If when={finishing()}>
                <Text onPress={() => finish()}>Finish download</Text>
              </If>
              <If when={restarted()}>
                <Text>Restarted</Text>
              </If>
            </View>
            <Toasts>
              <UpdateToast />
            </Toasts>
          </PaneContext.Provider>
        </KeyScope>
      </KeysHost>
    );
  }),
);
