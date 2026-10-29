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
  server's statuses say. Checked by the notifier's tests.
- The browser's permission MUST be asked only after the human is told what will notify, never on
  page load. Checked by the notifier's tests.
- A refused permission MUST be kept, never asked again. Checked by the notifier's tests.
- Notifications MUST NOT interrupt a human who is already looking at Uraeda. Checked by the
  notifier's tests.
- A click on a notification MUST open its item. Checked by the notifier's tests.
- Notifications MUST come from an open page, without a service worker or Web Push, until a feature
  for the phone decides how. Checked by review.
- The tab's title SHOULD count the items that need the human. Checked by the notifier's tests.

## Why

A notification that always means an ask is one the human keeps on. Browsers ignore a permission
request no click asked for, and a refusal cannot be asked again, so the page explains first. Web
Push, for closed tabs and the phone, is as much work as the rest, and is left to its own feature.
History: [Redesign interface](../done/2026-10-16-redesign-interface.md).

## Alternatives considered

- Every finished chat reply notifying too: more notifications than asks. A chat blocked on an action
  is an ask, so it does notify.

## Consequences

- No notification reaches the iPhone or Chrome on Android, where pages cannot notify: the tab's
  title still counts.
- A later feature for the phone adds Web Push, and changes this decision.

## Applies to

- [`packages/web/`](/packages/web/) and [`packages/server/`](/packages/server/), and every feature
  that tells the human something happened: notifications, the tab's title, and a later Web Push
