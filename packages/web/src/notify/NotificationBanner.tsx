// The banner that asks, once per browser, whether Uraeda may notify it, above every page: the
// browser's own question comes only from "Turn on", since browsers ignore one that no click asked
// for. Its other states say why notifications cannot show.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";

/** What the banner says: the question, or why notifications cannot show after "Turn on". */
export type BannerState = "ask" | "blocked" | "unsupported";

export function NotificationBanner({
  onDismiss,
  onTurnOn,
  state,
}: {
  /** "Not now" or Dismiss: remembered in this browser. */
  onDismiss: () => void;
  onTurnOn: () => Promise<void>;
  state: BannerState;
}) {
  if (state === "blocked") {
    return (
      <Banner
        description="Allow notifications for this site in the browser's site settings to turn them on."
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={onDismiss}
        status="warning"
        title="Notifications are blocked for Uraeda."
      />
    );
  }
  if (state === "unsupported") {
    return (
      <Banner
        description="The tab's title still counts what waits on you."
        dismissLabel="Dismiss"
        isDismissable
        onDismiss={onDismiss}
        status="warning"
        title="This browser cannot show Uraeda's notifications."
      />
    );
  }
  return (
    <Banner
      description="Uraeda tells this browser when questions, a review, a pull request, or a blocked agent wait on you, while its tab is in the background."
      endContent={
        <HStack gap={2}>
          <Button label="Not now" onClick={onDismiss} variant="ghost" />
          <Button clickAction={onTurnOn} label="Turn on" variant="primary" />
        </HStack>
      }
      status="info"
      title="Get notified when an agent needs you"
    />
  );
}
