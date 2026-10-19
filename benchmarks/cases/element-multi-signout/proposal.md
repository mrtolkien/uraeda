A code repository is available in the `/app` directory. Your task is to implement the changes
necessary to satisfy the following Pull Request (PR) description:

<pr_description>

## Title Device management does not support signing out of multiple sessions at once

## Description

The device management interface only allows users to sign out of one session at a time. This makes
session cleanup repetitive when a user needs to remove multiple devices.

Users should be able to select multiple devices from the device list, see how many sessions are
currently selected, cancel the selection, and sign out of all selected sessions in a single action.

## Requirements

- Users must be able to select and deselect individual devices from the device list.

- When one or more devices are selected, the device list header must display the number of currently
  selected sessions using the wording `%(selectedDeviceCount)s sessions selected`.

- When one or more devices are selected, the device list header must show a bulk sign-out action
  that signs out all currently selected device IDs in a single request.

- When one or more devices are selected, the device list header must show a cancel action that
  clears all selected devices.

- The bulk sign-out action must use `data-testid="sign-out-selection-cta"`.

- The cancel action must use `data-testid="cancel-selection-cta"`.

- Each selectable device checkbox must use `data-testid="device-tile-checkbox-${device.device_id}"`.

- A selectable device's checkbox `checked` state must reflect whether the device is selected.

- Clicking the selectable checkbox or the device tile information area must toggle that device
  selection.

- Clicking actions inside a device tile must not toggle device selection.

- When the active device filter changes, all selected devices must be cleared.

- After a successful device sign-out, the device list must refresh.

- If interactive authentication for device sign-out is cancelled, the sign-out loading state must be
  cleared.

## New Interfaces

No new interfaces are introduced. </pr_description>

Constraints:

- Do not reference, look up, or copy existing solutions, external PRs, or online workarounds. The
  implementation must be entirely your own independent work.
