// The pages the extensions own: a built-in's routes, which say it is off where it is, with a way to
// turn it on (`OffPage`), and yours, `/e/<name>/<id>…` (R1), which draw the place's component.
import { type ReactNode, use } from "react";
import { Missing } from "../layout/Missing.tsx";
import { Page } from "../layout/Page.tsx";
import type { Route } from "../routeTable.ts";
import { OffPage } from "./OffPage.tsx";
import { IsOnContext, useContributions } from "./useContributions.ts";

/** The built-in each route belongs to. */
const OWNERS: Partial<Record<Route["page"], string>> = {
  constitution: "decisions",
  decision: "decisions",
  decisions: "decisions",
  "decisions-check": "decisions",
  git: "git",
  inbox: "inbox",
  note: "inbox",
  priorities: "priorities",
  proposal: "priorities",
  triage: "inbox",
};

/** `children`, the page of `route`, unless its extension is off here: then why, and a way back. */
export function UnlessOff({ children, route }: { children: ReactNode; route: Route }) {
  const isOn = use(IsOnContext);
  const owner = route.page === "extension" ? route.name : OWNERS[route.page];
  if (owner !== undefined && !isOn(owner)) {
    return (
      <Page kind="rows">
        <OffPage name={owner} />
      </Page>
    );
  }
  return children;
}

/** An extension's place, by its path: its component, in the app's column, or that there is none. */
export function ExtensionPlace({ name, rest }: { name: string; rest: string }) {
  const path = `/e/${name}/${rest.split("/")[0]}`;
  const place = useContributions("place").find((one) => one.path === path);
  if (!place) {
    return (
      <Page kind="rows">
        <Missing title={`No place ${rest} in ${name}.`} />
      </Page>
    );
  }
  const Component = place.component;
  // In the app's column, at its widths, as Uraeda's own pages.
  return (
    <Page kind="rows">
      <Component />
    </Page>
  );
}
