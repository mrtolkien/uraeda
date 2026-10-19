---
status: proposed
approved-by:
icon: bell
---

# Notifications

Uraeda tells the human when something needs them, and only then, so a notification always means an
ask. It uses the browser's notifications from an open tab, and asks permission only once the human
understands what will notify. The phone and closed tabs are left to a later feature.

## Rules

- A notification MUST be shown only when an item, in any repository, comes to need the human, as the
  server's statuses say, never the web UI's own logic. Checked by the notifier's tests.
- The browser's permission MUST be asked only after the human is told what will notify, never on
  page load, and a refusal MUST be kept. Checked by the notifier's tests.
- Notifications MUST NOT interrupt a human who is already looking at Uraeda, and a click MUST open
  the item. Checked by the notifier's tests.
- Notifications MUST come from an open page, and MUST NOT use a service worker or Web Push until a
  feature for the phone decides how. Checked by review.
- The tab's title SHOULD count the items that need the human. Checked by the notifier's tests.

## Why

The human asked to be pinged when input is needed, for asks only, on desktop browsers, with the
tab's title counting what waits
([what sends a notification](../done/2026-10-16-redesign-interface.md#q11-what-sends-a-notification)).
Browsers ignore a permission request no click asked for, and a refusal cannot be asked again, so the
page explains first
([asking for permission](../done/2026-10-16-redesign-interface.md#q12-how-does-uraeda-ask-for-permission-to-notify)).

## Alternatives considered

- Web Push now, with a service worker and keys, for closed tabs and the iPhone: as much work as the
  rest, left to its own feature.
- Every finished chat reply notifying too: more notifications than asks.

## Consequences

- No notification reaches the iPhone or Chrome on Android, where pages cannot notify: the tab's
  title still counts.
- A later feature for the phone adds Web Push, and changes this decision.

## Applies to

- [`packages/web/`](/packages/web/) and [`packages/server/`](/packages/server/), and every feature
  that tells the human something happened: notifications, the tab's title, and a later Web Push
