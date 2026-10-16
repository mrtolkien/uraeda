// The notifier and the notification banner, as a repository's shell draws them: the notifier on the
// global client, which publishes what needs the human across every repository, left out if that
// read fails, so the page goes on; the banner above the page.
import { Component, type ReactNode, Suspense, use } from "react";
import { FateClient } from "react-fate";
import { useNeedsYou } from "../data.ts";
import { ListClientContext } from "../RepositoryMenu.tsx";
import { NotificationBanner } from "./NotificationBanner.tsx";
import { useNotificationBanner } from "./permission.ts";
import { useNotifier } from "./useNotifier.ts";

function Reader() {
  useNotifier(useNeedsYou()?.rows);
  return null;
}

/** Left out when its read fails: the notifications are no part of the page. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The notifier, drawing nothing. */
export function Notifier() {
  const client = use(ListClientContext);
  if (!client) {
    return null;
  }
  return (
    <FateClient client={client}>
      <Quiet>
        <Suspense fallback={null}>
          <Reader />
        </Suspense>
      </Quiet>
    </FateClient>
  );
}

/** The banner that asks to notify, or says why notifications cannot show, while it shows. */
export function NotifyBanner() {
  const { dismiss, state, turnOn } = useNotificationBanner();
  return state ? <NotificationBanner onDismiss={dismiss} onTurnOn={turnOn} state={state} /> : null;
}
