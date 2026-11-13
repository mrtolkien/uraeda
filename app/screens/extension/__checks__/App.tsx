// The app over the sandbox `just app-test` starts, as `extension.test.tsx` drives it: the real
// shell, opened on the inbox of `sample`. The test sends `go` with an address, which opens as a
// link would, and `off` or `on` with a built-in's name, which turns it off in `sample` alone or on
// everywhere again, as Settings, Extensions would; the app posts `done` once the server answered.
import { host, mount, signal, untracked } from "nsh";
import {
  call,
  connection,
  navigate,
  parseRoute,
  record,
  RecordsRoot,
  redirect,
} from "../../../store";
import type { Repositories } from "../../../store/protocol";
import { boot } from "../../shell/boot";
import { appHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const REPO = "sample";

/** The repositories, held by a view of this page: a listener reads what it holds, never a record. */
let repositories: () => Repositories | undefined = () => undefined;
function Held() {
  repositories = record("Repositories", null);
  return null;
}

/** Whether the shell's connection is live: the repositories are read from then on. */
const live = signal(false);
const look = () => (connection()?.status() === "live" ? live.set(true) : setTimeout(look, 50));

void boot().then(() => {
  redirect(parseRoute(`/r/${REPO}/inbox`));
  const shell = appHost();
  host.on("go", (address) => navigate(parseRoute(String(address))));
  host.on("off", (name) => {
    const others = (untracked(repositories)?.rows ?? [])
      .map((row) => row.name)
      .filter((one) => one !== REPO);
    void call("extensions.setOn", { name: String(name), on: others, onAll: false }).then(
      () => host.post("done", "off"),
      (error) => host.post("done", String(error)),
    );
  });
  host.on("on", (name) => {
    void call("extensions.setOn", { name: String(name), on: [], onAll: true }).then(
      () => host.post("done", "on"),
      (error) => host.post("done", String(error)),
    );
  });
  mount(() => (
    <>
      <Root host={shell} />
      <RecordsRoot value>
        <If when={live()}>
          <Held />
        </If>
      </RecordsRoot>
    </>
  ));
  look();
});
