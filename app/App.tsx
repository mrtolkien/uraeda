// The app's entry, which Native Shell runs. It reads what this device keeps, shows the theme and
// fonts shown last, from the first frame, then mounts the shell, which finds the server.
//
// `URAEDA_ROUTE`, an address of the app, `/r/<repository>/inbox`, opens the app there: a picture
// of a route (`just app-shots`) starts with it.
import { mount } from "nsh";
import { boot } from "./screens/shell/boot";
import { appHost } from "./screens/shell/host";
import { Root } from "./screens/shell/Root";
import { parseRoute, redirect } from "./store";

void boot().then(() => {
  const start = process.env.URAEDA_ROUTE;
  if (start !== undefined && start !== "") redirect(parseRoute(start));
  const host = appHost();
  mount(() => <Root host={host} />);
});
