// The app over the sandbox `just app-test` starts, as `extension.test.tsx` drives it: the real
// shell, opened on the inbox of `sample`. The test sends `go` with an address, which opens as a
// link would, and `off` or `on` with a built-in's name, which turns it off in `sample` alone or on
// everywhere again, as Settings, Extensions would; the app posts `done` once the server answered.
import { host, mount, untracked } from "nsh";
import { call, navigate, parseRoute, record, redirect } from "../../../store";
import { boot } from "../../shell/boot";
import { appHost } from "../../shell/host";
import { Root } from "../../shell/Root";

const REPO = "sample";

void boot().then(() => {
  redirect(parseRoute(`/r/${REPO}/inbox`));
  const shell = appHost();
  host.on("go", (address) => navigate(parseRoute(String(address))));
  host.on("off", (name) => {
    // The frame holds the list: this reads it as it is, once the app connected.
    const others = (untracked(record("Repositories", null))?.rows ?? [])
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
  mount(() => <Root host={shell} />);
});
