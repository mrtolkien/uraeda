// The app's entry, which Native Shell runs. It reads what this device keeps, shows the theme and
// fonts shown last, from the first frame, then mounts the shell, which finds the server.
//
// `URAEDA_ROUTE`, an address of the app, `/r/<repository>/inbox`, opens the app there: a picture
// of a route (`just app-shots`) starts with it. In a browser the page's own address does, so a
// reload or a shared address opens its page, and the shell signs in by the browser's session
// (`web/Web.tsx`).
import { mount, platform } from "nsh";
import { boot } from "./screens/shell/boot";
import { appHost } from "./screens/shell/host";
import { Root } from "./screens/shell/Root";
import { parseRoute, redirect } from "./store";
import { pageAddress } from "./web/host";
import { Web } from "./web/Web";

void boot().then(() => {
  const web = platform.os === "web";
  const start = web ? pageAddress() : process.env.URAEDA_ROUTE;
  if (start !== undefined && start !== "") redirect(parseRoute(start));
  if (web) return mount(() => <Web />);
  const host = appHost();
  mount(() => <Root host={host} />);
});
