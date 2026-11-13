// The app, opened on a new job's page of the sandbox's `sample` repository, as `jobs.test.tsx`
// drives it: the real shell over the sandbox `just app-test` starts (its address in
// `URAEDA_SANDBOX`). The test makes its own job: the sandbox's two are left as they are.
import { mount } from "nsh";
import { parseRoute, redirect } from "../../../store";
import { boot } from "../../shell/boot";
import { appHost } from "../../shell/host";
import { Root } from "../../shell/Root";

void boot().then(() => {
  redirect(parseRoute("/r/sample/jobs/new"));
  const host = appHost();
  mount(() => <Root host={host} />);
});
