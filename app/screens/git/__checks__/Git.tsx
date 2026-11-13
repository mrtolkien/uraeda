// The app, opened on the Git page of the sandbox's `sample` repository, as `git.test.tsx` drives
// it: the real shell over the sandbox `just app-test` starts (its address in `URAEDA_SANDBOX`).
import { mount } from "nsh";
import { parseRoute, redirect } from "../../../store";
import { boot } from "../../shell/boot";
import { appHost } from "../../shell/host";
import { Root } from "../../shell/Root";

void boot().then(() => {
  redirect(parseRoute("/r/sample/git"));
  const host = appHost();
  mount(() => <Root host={host} />);
});
