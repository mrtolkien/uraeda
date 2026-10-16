---
status: proposed
approved-by:
---

# Notifications

Uraeda tells the human when something needs them, through the browser's notifications, from an open
tab, while that tab is in the background. Only what asks something of the human notifies, the
browser is asked for permission only from a click, after the page explains what will notify, and the
tab's title counts what waits. Notifications on the phone and with every tab closed, through Web
Push, are left to a feature of their own.

## Rules

- A notification MUST be shown only for an item that needs the human: a step waiting on them once
  its run is over, an action the agent was refused, a run that failed or stopped before a gate, and
  a pull request ready for review. Checked by the notifier's tests.
- What needs the human MUST come from the server's statuses, through one view of the global endpoint
  that spans every repository. The web UI MUST NOT decide it. Checked by the notifier's tests and
  review.
- The browser's permission MUST be asked only from the human's click on "Turn on", in a banner that
  says what will notify, and never when a page loads. "Not now" MUST be kept in the browser, and the
  banner MUST NOT come back once it is. Checked by the notifier's tests.
- Notifications MUST be shown only while no Uraeda tab is in front, one per item and reason,
  replacing the previous one for that item, from a single tab among those open. Checked by the
  notifier's tests.
- An item that needed the human when the page loaded MUST NOT notify: only a change while the page
  is open does. Checked by the notifier's tests.
- Clicking a notification MUST bring its tab to the front and open the item, in its repository.
  Checked by the notifier's tests.
- The tab's title MUST start with the number of items that need the human, across every repository,
  like "(2) Uraeda", when there are any. Checked by the notifier's tests.
- Notifications MUST be shown from the page, with the Notifications API. A service worker and Web
  Push MUST NOT be added, until a feature for the phone and closed tabs decides how. Checked by
  review.

## Why

The human asked to be pinged when input is needed, and chose notifications for what needs them only,
from an open tab on desktop browsers, with the tab's title counting what waits, leaving the phone to
its own feature
([Q11](../2026-10-16-redesign-interface/clarifications-01.md#q11-what-sends-a-notification),
[Q13](../2026-10-16-redesign-interface/clarifications-01.md#q13-where-do-notifications-reach-you)).
Firefox and Safari ignore a permission request no click asked for, and a refusal cannot be asked
again, so the page explains first and asks on "Turn on"
([Q12](../2026-10-16-redesign-interface/clarifications-01.md#q12-how-does-uraeda-ask-for-permission-to-notify),
[browser notifications](../2026-10-16-redesign-interface/discovery-01.md#browser-notifications)).

## Alternatives considered

- Web Push now, with a service worker and keys, for a closed tab and an iPhone Home Screen app:
  about as much work as everything else, left to its own feature.
- Every finished chat reply notifying too: more notifications than asks.

## Consequences

- No notification reaches the iPhone, where Safari tabs cannot notify, nor Chrome on Android, where
  pages cannot notify without a service worker: the tab's title still counts.
- The global endpoint carries a view over every repository, read by every open tab.
- A later feature for the phone adds Web Push, and changes this decision.

## Applies to

- [`packages/web/`](/packages/web/) and [`packages/server/`](/packages/server/), and every feature
  that tells the human something happened: notifications, the tab's title, and a later Web Push
