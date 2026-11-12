// The app's entry, which Native Shell runs. It reads what this device keeps, shows the theme and
// fonts shown last, from the first frame, then mounts the shell, which finds the server.
//
// `URAEDA_ROUTE`, an address of the app, `/r/<repository>/inbox`, opens the app there: a picture
// of a route (`just app-shots`) starts with it. In a browser the tab's history is the app's, so
// the address bar follows the page shown, a reload or a shared address opens its page, and Back
// and Forward are the browser's; the shell signs in by the browser's session (`web/Web.tsx`).
// The browser's benchmark opens pages through its `uraedaBench.go`, as a link does (`ui/timing.ts`).
import { mount, platform } from "nsh";
import { boot } from "./screens/shell/boot";
import { appHost } from "./screens/shell/host";
import { Root } from "./screens/shell/Root";
import { bindHistory, navigate, parseRoute, redirect } from "./store";
import { browserHistory } from "./store/history.web";
import { page } from "./web/page";
import { Web } from "./web/Web";

void boot().then(() => {
  if (platform.os === "web") {
    bindHistory(browserHistory(page()));
    const bench = (page() as { uraedaBench?: { go?: (address: string) => void } }).uraedaBench;
    if (bench !== undefined) bench.go = (address) => navigate(parseRoute(address));
    return mount(() => <Web />);
  }
  const start = process.env.URAEDA_ROUTE;
  if (start !== undefined && start !== "") redirect(parseRoute(start));
  const host = appHost();
  mount(() => <Root host={host} />);
});
