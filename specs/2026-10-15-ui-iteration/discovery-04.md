# Discovery, round 04: UI iteration flow

## Why this round

The final review of the branch tried Storybook's full interface, the Storybook page of US5, against
Uraeda's own Storybook served through Uraeda. Its list of stories loads, but no story renders in its
canvas, and its controls never fill. Embeds, which show one story frame alone, work. Fixing the page
needs a Storybook setting its own code calls insecure, so it is your call.

## Summary

- **Why the page breaks.** Every preview frame is sandboxed without its own origin, as the
  [stack](/specs/decisions/stack.md) decision requires. Storybook's interface and its story frame
  talk by `postMessage`. In dev mode, Storybook 10.6.2 pins each message to the frame's expected
  origin, and refuses messages from any other origin. A sandboxed frame's origin is `null`, so
  WebKit drops every message: "Unable to post message to http://127.0.0.1:… Recipient has origin
  null".
- **The setting.** Storybook's `security.insecureIframeMessaging` turns that pinning off. Its
  interface then posts to its story frame with the target `*`. It accepts messages from its own
  registered story frames, which the browser identifies by window, whatever their origin.
- **What it gives up.** Storybook's warning describes the case it guards against: "a page the iframe
  navigated to cannot send them". With the setting, a story frame that navigated to another site
  could still exchange messages with the interface. Only the project's own story code can navigate
  that frame (judgement).
- **What it does not change.** The interface still accepts messages only from its own story frames,
  never from a page that embeds it. Uraeda's frames stay sandboxed, and the guard and proxy rules do
  not change.

## How other products do it

### Storybook's own warning

- Storybook's interface, refusing a message from an unexpected origin, says: "While it runs in dev
  mode, the manager only accepts channel messages from the origin each preview iframe was given, so
  a page the iframe navigated to cannot send them. To accept messages from any origin, set
  "security.insecureIframeMessaging" to true." (`storybook/dist/channels/index.js`, 10.6.2).

### What they have in common

Products that run generated UI in an origin-less frame, like Claude artifacts and MCP Apps
([discovery 02](discovery-02.md#running-untrusted-ui-next-to-a-host)), identify their frames by
window, not by origin, as the setting makes Storybook do.

## Standards and libraries

### Storybook's iframe channel

- `PostMessageTransport` sets `pinsTargetOrigin` when `CONFIG_TYPE` is `DEVELOPMENT` and
  `INSECURE_IFRAME_MESSAGING` is not `true`, then posts to the frame with that origin instead of `*`
  (`storybook/dist/channels/index.js`, lines 104 and 154, version 10.6.2).
- `isAllowedToContactManager` accepts a message only from an iframe marked `data-is-storybook` whose
  window sent it. Without pinning, it accepts any origin from that frame. With pinning, it also
  needs the origin the frame was given, which a sandboxed frame never has (same file, lines
  225–243).

## The code

### Important reads

- [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js) wraps a project's
  Storybook config when `URAEDA_PREVIEW_BASE` is set. It is where the setting would go, so only a
  Storybook served by Uraeda gets it.
- [`StorybookPage.tsx`](/packages/web/src/StorybookPage.tsx) frames the interface, sandboxed to
  `allow-scripts allow-popups`.
- The browser tests use a fake Storybook, which does not pin origins, so they did not catch this.

### The proposal's path and existing actions

- **Embeds** show one story frame alone, with no interface around it: they work, and do not change.
- **"Open in Storybook"** and the Storybook rows lead to the page, which today shows the list only.

### Likely changes

- With option A: the helper sets the setting, a test covers it, and the hand validation script
  checks that a story renders in the page.
- With option B: "Open in Storybook" opens Storybook's own address, and the Storybook page goes.

## The proposal

### The full Storybook page

The spec's review asked for "the full, standard storybook UI", and US5 builds it inside Uraeda. It
cannot work through Uraeda's sandbox without the setting.

## Approaches

### Storybook's full interface inside Uraeda

| Option                                                                                            | Through Tailscale | Security                                                  |
| ------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------- |
| A. The helper turns on `insecureIframeMessaging` when Uraeda serves the Storybook                 | Works             | A navigated story frame could still message the interface |
| B. "Open in Storybook" opens Storybook on its own port, in a new tab, and the Storybook page goes | Not from a phone  | Unchanged                                                 |
| C. Keep the page as it is, list only, until basic security                                        | List only         | Unchanged                                                 |

### Needs no choice

- **Embeds**: unaffected by any option.

## Not checked

- Whether other Storybook frameworks than React and Vite pin origins the same way.
